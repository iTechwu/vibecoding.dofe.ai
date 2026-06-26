import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  LoopAnnotation,
  LoopConvergencePr,
  LoopGlobalReviewRecord,
  LoopIssue,
  LoopRuntimeMode,
  LoopShard,
  LoopSpec,
  LoopTestMatrix,
  LoopTestRecord,
} from '@repo/contracts';
import { LoopShardSchema, LoopSpecSchema } from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { z } from 'zod';
import type {
  LoopsAgentAdapter,
  LoopsDecomposition,
  LoopsGlobalReviewInput,
  LoopsReviewInput,
  LoopsReviewOutput,
  LoopsTestReviewOutput,
} from './loops-agent-adapter.interface';
import { DeterministicLoopsAgentAdapter } from './deterministic-loops-agent.adapter';
import { extractJson, runProcess } from './loops-process.util';
import { readLoopsRuntimeConfig } from '@app/services/loops-store';
import { LoopsWorkspaceProfileService } from '@app/services/loops-runtime';
import { planAgentInvocation } from '../loops-runtime-command-builder.util';

const CodexReviewOutputSchema = z.object({
  verdict: z.enum(['PASS', 'NEEDS-WORK', 'FAIL']),
  issues: z
    .array(
      z.object({
        severity: z.enum(['minor', 'major', 'critical']),
        desc: z.string().trim().min(1),
      }),
    )
    .default([]),
  fixInstructions: z.array(z.string().trim().min(1)).default([]),
  summary: z.string().trim().min(1),
});

/**
 * 真实 Codex CLI 大脑实现（07 §2 六类调用）。
 *
 * 以 headless `codex exec` 调用，输入构造好的 Prompt + 输出 schema 要求，解析 JSON。
 * 任何一次调用不可用 / 解析失败 / schema 不符时，降级到 `DeterministicLoopsAgentAdapter`，
 * 并记录 warn 日志（07 §7：Codex 输出不符合 schema → 解析失败重试，仍失败则报错告警）。
 *
 * 仅在 `LOOPS_AGENT_MODE=cli` 时由 Module 注入；默认仍为确定性实现。
 * 具体 `codex` 子命令/flag 以所用 CLI 版本为准，封装在本 Adapter 内，不外泄到编排层。
 */
@Injectable()
export class CliLoopsAgentAdapter implements LoopsAgentAdapter {
  private readonly fallback = new DeterministicLoopsAgentAdapter();

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Optional()
    private readonly workspaceProfile?: LoopsWorkspaceProfileService,
  ) {}

  async plan(issue: LoopIssue, createdAt: string): Promise<LoopSpec> {
    const prompt = this.buildPrompt('plan', { issue });
    const spec = await this.callCodexWithParsedOutput(prompt, 'plan', (candidate) =>
      this.asSpec(issue, createdAt, candidate),
    );
    if (spec) return spec;
    return this.fallback.plan(issue, createdAt);
  }

  async decompose(issue: LoopIssue, spec: LoopSpec): Promise<LoopsDecomposition> {
    const prompt = this.buildPrompt('decompose', { issue, spec });
    const shards = await this.callCodexWithParsedOutput(prompt, 'decompose', (candidate) =>
      this.asShards(candidate),
    );
    if (shards) {
      return { shards, annotations: this.initialAnnotations(issue, spec, shards) };
    }
    return this.fallback.decompose(issue, spec);
  }

  async designTests(
    issue: LoopIssue,
    spec: LoopSpec,
    shards: LoopShard[],
    createdAt: string,
  ): Promise<LoopTestMatrix> {
    return this.fallback.designTests(issue, spec, shards, createdAt);
  }

  async reviewTests(input: {
    matrix?: LoopTestMatrix;
    testRecord?: LoopTestRecord;
  }): Promise<LoopsTestReviewOutput> {
    return this.fallback.reviewTests(input);
  }

  async review(input: LoopsReviewInput): Promise<LoopsReviewOutput> {
    const prompt = this.buildPrompt('review', {
      shard: input.shard,
      record: input.implementationRecord,
    });
    const parsed = await this.callCodexWithParsedOutput(prompt, 'review', (candidate) =>
      this.asReview(candidate),
    );
    if (parsed) return parsed;
    return this.fallback.review(input);
  }

  async reviewGlobal(input: LoopsGlobalReviewInput): Promise<LoopsReviewOutput> {
    const prompt = this.buildPrompt('reviewGlobal', {
      shards: input.shards,
      records: input.implementationRecords.length,
    });
    const parsed = await this.callCodexWithParsedOutput(prompt, 'reviewGlobal', (candidate) =>
      this.asReview(candidate),
    );
    if (parsed) return parsed;
    return this.fallback.reviewGlobal(input);
  }

  async annotateFinalize(input: {
    issue: LoopIssue;
    spec?: LoopSpec;
    shards: LoopShard[];
    annotations: LoopAnnotation[];
    globalVerdict: 'PASS' | 'NEEDS-WORK' | 'FAIL';
    testMatrix?: LoopTestMatrix;
    globalReview?: LoopGlobalReviewRecord;
    convergencePr?: LoopConvergencePr;
  }): Promise<LoopAnnotation[]> {
    return this.fallback.annotateFinalize(input);
  }

  private async callCodexWithParsedOutput<T>(
    prompt: string,
    kind: string,
    parse: (raw: unknown) => T | undefined,
  ): Promise<T | undefined> {
    const attempts = (await this.maxRetry()) + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const raw = await this.callCodex(prompt, kind);
      const parsed = parse(raw);
      if (parsed) return parsed;
      if (attempt < attempts) {
        this.logger.warn?.(
          `Codex CLI ${kind} returned invalid schema (attempt=${attempt}/${attempts}); retrying.`,
          'CliLoopsAgentAdapter',
        );
      }
    }
    this.logger.warn?.(
      `Codex CLI ${kind} returned invalid schema after ${attempts} attempts; falling back to deterministic.`,
      'CliLoopsAgentAdapter',
    );
    return undefined;
  }

  private async callCodex(prompt: string, kind: string): Promise<unknown | undefined> {
    // Local-CLI first, Docker fallback (0622 · B3). Codex `exec` doesn't take a
    // cwd flag, so local mode relies on the process cwd (the workspace root)
    // while Docker mode mounts it via the planner.
    const runtime = await this.resolveRuntime('codex');
    const invocation = planAgentInvocation({
      mode: runtime.mode,
      agent: 'codex',
      hostWorkspaceRoot: runtime.hostWorkspaceRoot,
      containerWorkdir: runtime.containerWorkdir,
      buildAgentArgs: () => ['exec', '--json', prompt],
    });
    const result = await runProcess({
      command: invocation.command,
      args: invocation.args,
      cwd: invocation.cwd,
      timeoutMs: await this.codexTimeoutMs(),
    });
    if (result.exitCode !== 0) {
      this.logger.warn?.(
        `Codex CLI unavailable/failed for ${kind} (exit=${result.exitCode}, attempts=${result.attempts}); falling back to deterministic.`,
        'CliLoopsAgentAdapter',
      );
      return undefined;
    }
    return extractJson(result.stdout);
  }

  /**
   * Resolve runtime mode + workspace root for Codex (0622 · B3). Codex is a
   * "brain" call without a per-call cwd, so the workspace root comes from the
   * current workspace profile (defaulting to the discovered repo root).
   */
  private async resolveRuntime(agent: 'codex' | 'claude-code'): Promise<{
    mode: LoopRuntimeMode;
    hostWorkspaceRoot: string;
    containerWorkdir: string;
  }> {
    if (!this.workspaceProfile) {
      return {
        mode: 'local-cli',
        hostWorkspaceRoot: process.cwd(),
        containerWorkdir: '/workspace',
      };
    }
    try {
      const workspace = await this.workspaceProfile.resolve();
      return {
        mode: workspace.agents[agent].mode,
        hostWorkspaceRoot: workspace.root,
        containerWorkdir: workspace.containerWorkdir ?? '/workspace',
      };
    } catch {
      return {
        mode: 'local-cli',
        hostWorkspaceRoot: process.cwd(),
        containerWorkdir: '/workspace',
      };
    }
  }

  private async maxRetry() {
    return (
      this.envNonNegativeInteger('LOOPS_MAX_RETRY') ?? (await readLoopsRuntimeConfig()).maxRetry
    );
  }

  private async codexTimeoutMs() {
    return (
      this.envPositiveNumber('LOOPS_CODEX_TIMEOUT_MS') ??
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

  private buildPrompt(kind: string, ctx: Record<string, unknown>): string {
    const base = `你是 Loops 的 Codex 大脑，调用类型=${kind}。严格输出 JSON，不要额外解释。`;
    return `${base}\n上下文:\n${JSON.stringify(ctx).slice(0, 20000)}`;
  }

  private asSpec(issue: LoopIssue, createdAt: string, raw: unknown): LoopSpec | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const candidateInput = raw as { body?: unknown; contextBudget?: unknown };
    if (typeof candidateInput.body !== 'string') return undefined;
    const candidate = {
      id: `spec-${issue.id.replace('issue-', '')}`,
      issueId: issue.id,
      version: 'v1',
      status: 'DRAFT',
      created: createdAt,
      contextBudget:
        typeof candidateInput.contextBudget === 'number' ? candidateInput.contextBudget : 24000,
      body: candidateInput.body,
    };
    const parsed = LoopSpecSchema.safeParse(candidate);
    if (!parsed.success) return undefined;
    return parsed.data;
  }

  private asShards(raw: unknown): LoopShard[] | undefined {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { shards?: unknown }).shards)) {
      return undefined;
    }
    const parsed = LoopShardSchema.array().safeParse((raw as { shards: unknown }).shards);
    if (!parsed.success || parsed.data.length === 0) return undefined;
    return parsed.data;
  }

  private asReview(raw: unknown): LoopsReviewOutput | undefined {
    const parsed = CodexReviewOutputSchema.safeParse(raw);
    if (!parsed.success) return undefined;
    return parsed.data;
  }

  private initialAnnotations(
    issue: LoopIssue,
    spec: LoopSpec,
    shards: LoopShard[],
  ): LoopAnnotation[] {
    return [
      {
        target: issue.id,
        annotator: 'system',
        round: 1,
        implStatus: 'in-progress',
        testStatus: 'not-run',
        verdict: 'unreviewed',
        coverage: 'partial',
        location: ['.loops/issues', '.loops/intakes'],
        risk: 'medium',
        notes: 'Codex CLI 拆解产物；等待实施与测试证据。',
      },
      {
        target: spec.id,
        annotator: 'system',
        round: 1,
        implStatus: 'in-progress',
        testStatus: 'not-run',
        verdict: 'pass',
        coverage: 'partial',
        location: ['.loops/specs'],
        risk: 'medium',
        notes: 'Spec 已通过人工门禁并进入拆解。',
      },
      ...shards.map((shard) => ({
        target: shard.id,
        annotator: 'system' as const,
        round: 1,
        implStatus: 'not-started' as const,
        testStatus: 'missing' as const,
        verdict: 'unreviewed' as const,
        coverage: 'partial' as const,
        location: shard.filesHint,
        risk: 'medium' as const,
        notes: 'Shard 已由 Codex 生成，等待实施与测试证据。',
      })),
    ];
  }
}
