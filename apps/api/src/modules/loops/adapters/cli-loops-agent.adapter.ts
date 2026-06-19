import { Inject, Injectable } from '@nestjs/common';
import type {
  LoopAnnotation,
  LoopImplementationRecord,
  LoopIssue,
  LoopReviewRecord,
  LoopShard,
  LoopSpec,
  LoopTestMatrix,
  LoopTestRecord,
} from '@repo/contracts';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
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

  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  async plan(issue: LoopIssue, createdAt: string): Promise<LoopSpec> {
    const prompt = this.buildPrompt('plan', { issue });
    const raw = await this.callCodex(prompt, 'plan');
    if (raw) {
      const spec = this.asSpec(issue, createdAt, raw);
      if (spec) return spec;
    }
    return this.fallback.plan(issue, createdAt);
  }

  async decompose(issue: LoopIssue, spec: LoopSpec): Promise<LoopsDecomposition> {
    const prompt = this.buildPrompt('decompose', { issue, spec });
    const raw = await this.callCodex(prompt, 'decompose');
    if (raw && Array.isArray(raw.shards)) {
      const shards = raw.shards as LoopShard[];
      if (shards.length > 0) {
        return { shards, annotations: this.initialAnnotations(issue, spec, shards) };
      }
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
    const prompt = this.buildPrompt('review', { shard: input.shard, record: input.implementationRecord });
    const raw = await this.callCodex(prompt, 'review');
    const parsed = this.asReview(raw);
    if (parsed) return parsed;
    return this.fallback.review(input);
  }

  async reviewGlobal(input: LoopsGlobalReviewInput): Promise<LoopsReviewOutput> {
    const prompt = this.buildPrompt('reviewGlobal', {
      shards: input.shards,
      records: input.implementationRecords.length,
    });
    const raw = await this.callCodex(prompt, 'reviewGlobal');
    const parsed = this.asReview(raw);
    if (parsed) return parsed;
    return this.fallback.reviewGlobal(input);
  }

  async annotateFinalize(input: {
    issue: LoopIssue;
    spec?: LoopSpec;
    shards: LoopShard[];
    annotations: LoopAnnotation[];
    globalVerdict: 'PASS' | 'NEEDS-WORK' | 'FAIL';
  }): Promise<LoopAnnotation[]> {
    return this.fallback.annotateFinalize(input);
  }

  private async callCodex(prompt: string, kind: string): Promise<any | undefined> {
    const result = await runProcess({
      command: 'codex',
      args: ['exec', '--json', prompt],
      timeoutMs: Number(process.env.LOOPS_CODEX_TIMEOUT_MS ?? 300_000),
    });
    if (result.exitCode !== 0) {
      this.logger.warn?.(
        `Codex CLI unavailable/failed for ${kind} (exit=${result.exitCode}); falling back to deterministic.`,
        'CliLoopsAgentAdapter',
      );
      return undefined;
    }
    return extractJson(result.stdout);
  }

  private buildPrompt(kind: string, ctx: Record<string, unknown>): string {
    const base = `你是 Loops 的 Codex 大脑，调用类型=${kind}。严格输出 JSON，不要额外解释。`;
    return `${base}\n上下文:\n${JSON.stringify(ctx).slice(0, 20000)}`;
  }

  private asSpec(issue: LoopIssue, createdAt: string, raw: any): LoopSpec | undefined {
    if (!raw || typeof raw.body !== 'string') return undefined;
    return {
      id: `spec-${issue.id.replace('issue-', '')}`,
      issueId: issue.id,
      version: 'v1',
      status: 'DRAFT',
      created: createdAt,
      contextBudget: typeof raw.contextBudget === 'number' ? raw.contextBudget : 24000,
      body: raw.body,
    };
  }

  private asReview(raw: any): LoopsReviewOutput | undefined {
    if (!raw) return undefined;
    const verdict = raw.verdict;
    if (verdict !== 'PASS' && verdict !== 'NEEDS-WORK' && verdict !== 'FAIL') return undefined;
    return {
      verdict,
      issues: Array.isArray(raw.issues) ? (raw.issues as LoopsReviewOutput['issues']) : [],
      fixInstructions: Array.isArray(raw.fixInstructions) ? (raw.fixInstructions as string[]) : [],
      summary: typeof raw.summary === 'string' ? raw.summary : '',
    };
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
