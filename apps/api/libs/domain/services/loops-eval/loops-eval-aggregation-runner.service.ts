import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LoopEvalAggregationService } from '@app/db/loop-eval-aggregation';
import {
  LOOPS_EVAL_EVIDENCE_PORT,
  type LoopsAggregation,
  type LoopsEvalEvidencePort,
  type LoopsEvalLogSink,
  LoopsEvalService,
} from './loops-eval.service';
import { LoopsEvalAggregationWorkerService } from './loops-eval-aggregation-worker.service';

/**
 * Loops Eval Aggregation Runner — `@app/services/loops-eval`.
 *
 * 结构优化 nextstep Step N2 收尾：把 facade 里 aggregation worker 的 DB/Redis 适配
 *（compute / persist / warm）下沉到 domain。runner 注入 `LoopEvalAggregationService`
 *（DB）+ `LoopsEvalAggregationWorkerService`（Redis，同 module）+ `LOOPS_EVAL_EVIDENCE_PORT`
 *（evidence 收集，facade 提供），编排委托 `LoopsEvalService.runEvalAggregationWorker`。
 *
 * `LoopsEvalAggregationProcessor` 与 facade 都经本 runner 触发 aggregation，processor
 * 不再注入 legacy facade 类。evidence 收集仍由 port 提供，待 list/readDetail enrichment
 * 下沉后再迁入。
 */
@Injectable()
export class LoopsEvalAggregationRunnerService {
  constructor(
    private readonly evalService: LoopsEvalService,
    @Optional()
    private readonly aggregationWorker?: LoopsEvalAggregationWorkerService,
    @Optional()
    private readonly evalAggregationDb?: LoopEvalAggregationService,
    @Optional()
    @Inject(LOOPS_EVAL_EVIDENCE_PORT)
    private readonly evidencePort?: LoopsEvalEvidencePort,
  ) {}

  async runAggregation(input: {
    tenantId?: string;
    period?: '7d' | '30d' | '90d' | 'all';
    logSink?: LoopsEvalLogSink;
  }): Promise<{
    processed: number;
    persisted: number;
    cachedInRedis: boolean;
    period: string;
    generatedAt: string;
  }> {
    return this.evalService.runEvalAggregationWorker({
      tenantId: input.tenantId,
      period: input.period,
      evidencePort: this.evidencePort ?? this.emptyEvidencePort,
      computeAggregation: (flat, period) =>
        this.aggregationWorker ? this.aggregationWorker.computeAggregation(flat, period) : [],
      persistAggregation: this.evalAggregationDb
        ? async (agg, period) => {
            await this.evalAggregationDb!.upsert({
              where: { id: agg.tenantId + '-' + agg.suiteId + '-' + period },
              create: {
                id: agg.tenantId + '-' + agg.suiteId + '-' + period,
                tenantId: agg.tenantId,
                workspaceId: agg.workspaceId,
                suiteId: agg.suiteId,
                blueprintId: agg.blueprintId ?? null,
                totalChecks: agg.totalChecks,
                passedChecks: agg.passedChecks,
                failedChecks: agg.failedChecks,
                blockedChecks: agg.blockedChecks,
                passRate: agg.passRate,
                averageScore: agg.averageScore,
                loopCount: agg.loopCount,
                trendDelta: agg.trendDelta ?? null,
                period: agg.period,
                capturedAt: new Date(agg.capturedAt),
              },
              update: {
                totalChecks: agg.totalChecks,
                passedChecks: agg.passedChecks,
                failedChecks: agg.failedChecks,
                blockedChecks: agg.blockedChecks,
                passRate: agg.passRate,
                averageScore: agg.averageScore,
                loopCount: agg.loopCount,
                trendDelta: agg.trendDelta ?? null,
                capturedAt: new Date(agg.capturedAt),
              },
            } as Prisma.LoopEvalAggregationUpsertArgs);
            return true;
          }
        : undefined,
      warmCache: this.aggregationWorker
        ? async (agg: LoopsAggregation, period: string) => {
            await this.aggregationWorker!.setCachedAggregation(agg.tenantId, agg.suiteId, period, {
              aggregations: [agg as unknown as Record<string, unknown>],
            });
          }
        : undefined,
      logSink: input.logSink,
    });
  }

  /** Fallback evidence port when the facade-provided port is absent (e.g. tests). */
  private get emptyEvidencePort(): LoopsEvalEvidencePort {
    return {
      collectEvalEvidence: async () => ({ suites: [], runs: [] }),
      collectLoopBenchInputs: async () => ({ list: [] }),
    };
  }

  /** Redis cache health passthrough (delegates to the aggregation worker). */
  async cacheHealth(): Promise<{
    available: boolean;
    cachedKeys: number;
    message: string;
  }> {
    if (this.aggregationWorker) {
      return this.aggregationWorker.cacheHealth();
    }
    return { available: false, cachedKeys: 0, message: 'Eval aggregation worker not configured' };
  }
}
