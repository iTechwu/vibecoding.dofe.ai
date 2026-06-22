import { Inject, Injectable, Optional } from '@nestjs/common';
import type { LoopImplementationRecord, LoopRuntimeMode } from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { z } from 'zod';
import type { LoopsClaudeAdapter, LoopsClaudeRunInput } from './loops-claude-adapter.interface';
import { DeterministicLoopsClaudeAdapter } from './deterministic-loops-claude.adapter';
import { extractJson, runProcess } from './loops-process.util';
import { resolveAllowedTargetRepo } from '../loops-path-policy.util';
import { readLoopsRuntimeConfig } from '../loops-runtime-config.util';
import { LoopsWorkspaceProfileService } from '../loops-workspace-profile.service';
import { planAgentInvocation } from '../loops-runtime-command-builder.util';

const ClaudeCliResultSchema = z.object({
  summary: z.string().trim().min(1).optional(),
  changedFiles: z.array(z.string().trim().min(1)).default([]),
  testsChanged: z.array(z.string().trim().min(1)).default([]),
  tokens: z.number().int().nonnegative().optional(),
});

/**
 * 真实 Claude Code CLI 双手实现（07 §3）。
 *
 * 以非交互模式 `claude -p <prompt> --output-format json --add-dir <root>` 启动一个独立进程实施单个 Shard，
 * 回收 stdout 中的结构化结果生成 Implementation Record。当 `claude` 不可用或调用失败时，
 * 优雅降级到 `DeterministicLoopsClaudeAdapter`，保证 Loop 仍可推进。
 *
 * 仅在 `LOOPS_AGENT_MODE=cli` 时由 Module 注入；默认仍为确定性实现。
 */
@Injectable()
export class CliLoopsClaudeAdapter implements LoopsClaudeAdapter {
  private readonly fallback = new DeterministicLoopsClaudeAdapter();

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Optional()
    private readonly workspaceProfile?: LoopsWorkspaceProfileService,
  ) {}

  async run(input: LoopsClaudeRunInput) {
    const { shard } = input;
    const prompt = this.renderPrompt(input);
    const attempts = (await this.maxRetry()) + 1;
    const timeoutMs = await this.shardTimeoutMs();
    const safeCwd = await resolveAllowedTargetRepo(input.cwd);
    const runtime = await this.resolveRuntime('claude-code');

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      // Local-CLI first, Docker fallback (0622 · B3): the planner assembles the
      // argv for whichever mode the workspace profile selects, mounting only
      // `safeCwd` when Docker is used.
      const invocation = planAgentInvocation({
        mode: runtime.mode,
        agent: 'claude-code',
        hostWorkspaceRoot: safeCwd,
        containerWorkdir: runtime.containerWorkdir,
        buildAgentArgs: (workdir) => [
          '-p',
          prompt,
          '--output-format',
          'json',
          '--add-dir',
          workdir,
          '--permission-mode',
          'acceptEdits',
        ],
      });
      const result = await runProcess({
        command: invocation.command,
        args: invocation.args,
        cwd: invocation.cwd,
        timeoutMs,
      });

      if (result.exitCode !== 0) {
        if (attempt < attempts) {
          this.logger.warn?.(
            `Claude Code CLI unavailable/failed for ${shard.id} (exit=${result.exitCode}, attempt=${attempt}/${attempts}); retrying.`,
            'CliLoopsClaudeAdapter',
          );
          continue;
        }
        this.logger.warn?.(
          `Claude Code CLI unavailable/failed for ${shard.id} (exit=${result.exitCode}) after ${attempts} attempts; falling back to deterministic implementation.`,
          'CliLoopsClaudeAdapter',
        );
        return this.fallback.run(input);
      }

      const parsed = ClaudeCliResultSchema.safeParse(extractJson(result.stdout));
      if (!parsed.success) {
        if (attempt < attempts) {
          this.logger.warn?.(
            `Claude Code CLI returned invalid implementation schema for ${shard.id} (attempt=${attempt}/${attempts}); retrying.`,
            'CliLoopsClaudeAdapter',
          );
          continue;
        }
        this.logger.warn?.(
          `Claude Code CLI returned invalid implementation schema for ${shard.id} after ${attempts} attempts; falling back to deterministic implementation.`,
          'CliLoopsClaudeAdapter',
        );
        return this.fallback.run(input);
      }

      const output = parsed.data;
      const created = new Date().toISOString();
      const record: LoopImplementationRecord = {
        id: `impl-record-${shard.id}-r${input.round}-${Date.now()}`,
        issueId: input.issue.id,
        shardId: shard.id,
        round: input.round,
        implementer: 'claude-code',
        status: 'IMPLEMENTED',
        summary: output.summary || `Claude Code 已实施 Shard：${shard.acceptance.join('；')}`,
        changedFiles:
          output.changedFiles.length > 0 ? output.changedFiles : shard.filesHint.slice(0, 2),
        notes: '真实 Claude Code CLI 实施；解析自 --output-format json 输出。',
        created,
        tokens: output.tokens ?? Math.round(result.stdout.length / 4),
        durationSec: Math.max(1, Math.round(result.durationMs / 1000)),
        testsChanged: output.testsChanged,
      };
      return { record };
    }

    return this.fallback.run(input);
  }

  private async maxRetry() {
    return (
      this.envNonNegativeInteger('LOOPS_MAX_RETRY') ?? (await readLoopsRuntimeConfig()).maxRetry
    );
  }

  private async shardTimeoutMs() {
    return (
      this.envPositiveNumber('LOOPS_SHARD_TIMEOUT_MS') ??
      (await readLoopsRuntimeConfig()).shardTimeoutSec * 1000
    );
  }

  private envNonNegativeInteger(name: string) {
    const parsed = Number(process.env[name]);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private envPositiveNumber(name: string) {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  /**
   * Resolve the runtime mode + container workdir for this agent from the
   * workspace profile (0622 · B3). Defaults to local-CLI when no profile is
   * wired in (standalone consumers) so existing behaviour is preserved.
   */
  private async resolveRuntime(agent: 'codex' | 'claude-code'): Promise<{
    mode: LoopRuntimeMode;
    containerWorkdir: string;
  }> {
    if (!this.workspaceProfile) {
      return { mode: 'local-cli', containerWorkdir: '/workspace' };
    }
    try {
      const workspace = await this.workspaceProfile.resolve();
      return {
        mode: workspace.agents[agent].mode,
        containerWorkdir: workspace.containerWorkdir ?? '/workspace',
      };
    } catch {
      return { mode: 'local-cli', containerWorkdir: '/workspace' };
    }
  }

  private renderPrompt(input: LoopsClaudeRunInput) {
    const { shard } = input;
    return [
      `你正在独立实施 Loops 的一个 Task Shard（上下文隔离，不要引用其它 Shard 的历史）。`,
      `Shard: ${shard.id}`,
      `标题: ${shard.title}`,
      `验收标准:`,
      ...shard.acceptance.map((item) => `- ${item}`),
      `请逐条对照上述验收标准实施，尤其不要遗漏来自用户初始需求的验收项。`,
      `测试要求(unit/integration/e2e):`,
      ...[
        ...shard.testRequirements.unit,
        ...shard.testRequirements.integration,
        ...shard.testRequirements.e2e,
      ].map((item) => `- ${item}`),
      `完成后请输出 JSON：{"summary": string, "changedFiles": string[], "testsChanged": string[], "tokens": number}，summary 中必须说明每条验收标准的覆盖证据。`,
    ].join('\n');
  }
}
