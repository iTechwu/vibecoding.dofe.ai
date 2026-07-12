import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { BadRequestException, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { LoopsEvalAggregationRunnerService, type LoopsEvalLogSink } from '@app/services/loops-eval';

/**
 * R33+: BullMQ processor for periodic cross-tenant Eval aggregation.
 *
 * Queue: `loops-eval-aggregation`
 * Jobs:
 *   - `aggregate-tenant` — Single tenant aggregation (faster, targeted).
 *
 * Schedule (via BullMQ repeatable jobs or external cron trigger):
 *   - `aggregate-tenant` is scheduled only after the caller has resolved an
 *     SSO tenant scope. Cross-tenant sweeps require a separate SSO-admin
 *     enumeration flow and are deliberately not approximated with `default`.
 *
 * Graceful degradation: if Redis or DB is unavailable, the job logs a warning
 * and retries with exponential backoff (max 3 attempts).
 */
@Processor('loops-eval-aggregation', {
  concurrency: 1, // Single worker for aggregation — avoid concurrent DB writes
  limiter: {
    max: 10, // Max 10 jobs per second
    duration: 1000,
  },
})
export class LoopsEvalAggregationProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly aggregationRunner: LoopsEvalAggregationRunnerService,
  ) {
    super();
  }

  private get domainLogSink(): LoopsEvalLogSink {
    return {
      log: (level, message, meta) => {
        if (level === 'info') this.logger.info(message, meta);
        else if (level === 'warn') this.logger.warn(message, meta);
        else this.logger.error(message, meta);
      },
    };
  }

  async process(
    job: Job<
      { type: 'aggregate-all' | 'aggregate-tenant'; tenantId?: string; periods?: string[] },
      unknown,
      string
    >,
  ): Promise<{
    processed: number;
    persisted: number;
    cachedInRedis: boolean;
    period: string;
    generatedAt: string;
  }> {
    const { type = 'aggregate-all', tenantId, periods = ['7d', '30d', '90d', 'all'] } = job.data;

    this.logger.info(`[EvalAgg Processor] Starting job ${job.id}: ${type}`, {
      jobId: job.id,
      type,
      tenantId,
      attempt: job.attemptsMade + 1,
    });

    const results: Array<{
      processed: number;
      persisted: number;
      cachedInRedis: boolean;
      period: string;
      generatedAt: string;
    }> = [];

    if (type !== 'aggregate-tenant' || !tenantId) {
      throw new BadRequestException('An SSO-resolved tenant ID is required for eval aggregation');
    }

    for (const period of periods) {
      const result = await this.aggregationRunner.runAggregation({
        tenantId,
        period: period as '7d' | '30d' | '90d' | 'all',
        logSink: this.domainLogSink,
      });
      results.push(result);
    }

    // Also run cache health check
    await this.aggregationRunner.cacheHealth().then((health) => {
      this.logger.info(`[EvalAgg Processor] Redis cache health: ${health.message}`, health);
    });

    const total = {
      processed: results.reduce((s, r) => s + r.processed, 0),
      persisted: results.reduce((s, r) => s + r.persisted, 0),
      cachedInRedis: results.every((r) => r.cachedInRedis),
      period: periods.join(','),
      generatedAt: new Date().toISOString(),
    };

    this.logger.info(
      `[EvalAgg Processor] Job ${job.id} complete: ${total.processed} processed, ${total.persisted} persisted`,
      total,
    );

    return total;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.info(`[EvalAgg Processor] Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`[EvalAgg Processor] Job ${job?.id ?? 'unknown'} failed: ${error.message}`, {
      jobId: job?.id,
      error: error.message,
      stack: error.stack,
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job): void {
    this.logger.info(`[EvalAgg Processor] Job ${job.id} is now active`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`[EvalAgg Processor] Job ${jobId} has stalled`);
  }
}
