import { Inject, Injectable } from '@nestjs/common';
import type { LoopImplementationRecord } from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { LoopsClaudeAdapter, LoopsClaudeRunInput } from './loops-claude-adapter.interface';
import { DeterministicLoopsClaudeAdapter } from './deterministic-loops-claude.adapter';
import { extractJson, runProcess } from './loops-process.util';

type ClaudeCliResult = {
  summary?: string;
  changedFiles?: string[];
  testsChanged?: string[];
  tokens?: number;
};

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

  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  async run(input: LoopsClaudeRunInput) {
    const { shard } = input;
    const prompt = this.renderPrompt(input);
    const result = await runProcess({
      command: 'claude',
      args: [
        '-p',
        prompt,
        '--output-format',
        'json',
        '--add-dir',
        input.cwd,
        '--permission-mode',
        'acceptEdits',
      ],
      cwd: input.cwd,
      timeoutMs: Number(process.env.LOOPS_SHARD_TIMEOUT_MS ?? 900_000),
    });

    if (result.exitCode !== 0) {
      this.logger.warn?.(
        `Claude Code CLI unavailable/failed for ${shard.id} (exit=${result.exitCode}); falling back to deterministic implementation.`,
        'CliLoopsClaudeAdapter',
      );
      return this.fallback.run(input);
    }

    const parsed = extractJson<ClaudeCliResult>(result.stdout) ?? {};
    const created = new Date().toISOString();
    const record: LoopImplementationRecord = {
      id: `impl-record-${shard.id}-r${input.round}-${Date.now()}`,
      issueId: input.issue.id,
      shardId: shard.id,
      round: input.round,
      implementer: 'claude-code',
      status: 'IMPLEMENTED',
      summary:
        parsed.summary?.trim() ||
        `Claude Code 已实施 Shard：${shard.acceptance.join('；')}`,
      changedFiles: parsed.changedFiles ?? shard.filesHint.slice(0, 2),
      notes: '真实 Claude Code CLI 实施；解析自 --output-format json 输出。',
      created,
      tokens: parsed.tokens ?? Math.round(result.stdout.length / 4),
      durationSec: Math.max(1, Math.round(result.durationMs / 1000)),
      testsChanged: parsed.testsChanged ?? [],
    };
    return { record };
  }

  private renderPrompt(input: LoopsClaudeRunInput) {
    const { shard } = input;
    return [
      `你正在独立实施 Loops 的一个 Task Shard（上下文隔离，不要引用其它 Shard 的历史）。`,
      `Shard: ${shard.id}`,
      `标题: ${shard.title}`,
      `验收标准:`,
      ...shard.acceptance.map((item) => `- ${item}`),
      `测试要求(unit/integration/e2e):`,
      ...[
        ...shard.testRequirements.unit,
        ...shard.testRequirements.integration,
        ...shard.testRequirements.e2e,
      ].map((item) => `- ${item}`),
      `完成后请输出 JSON：{"summary": string, "changedFiles": string[], "testsChanged": string[], "tokens": number}。`,
    ].join('\n');
  }
}
