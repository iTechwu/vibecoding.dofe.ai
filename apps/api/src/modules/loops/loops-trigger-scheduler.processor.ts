import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { RedisService } from '@dofe/infra-redis';
import { LoopsService } from './loops.service';
import { LoopsFileStoreService } from '@app/services/loops-store';

/**
 * R34b: Trigger auto-execution engine via BullMQ repeatable jobs.
 *
 * Queue: `loops-trigger-scheduler`
 *
 * Architecture:
 * - A repeatable BullMQ job fires every 60 seconds.
 * - It scans all active schedule triggers from the file store.
 * - For each trigger whose nextRunAt ≤ now, it fires the trigger (calls
 *   LoopsService.fireScheduleTrigger).
 * - Success/failure is tracked on the trigger (lastRunAt, failureCount).
 * - A distributed lock via Redis ensures only one scheduler instance runs
 *   across multi-instance deployments.
 *
 * This replaces the gap where schedule triggers existed as CRUD objects
 * but had no actual cron execution engine.
 */
@Processor('loops-trigger-scheduler', {
  concurrency: 1, // Single scheduler — avoid duplicate fires
})
export class LoopsTriggerSchedulerProcessor extends WorkerHost {
  private readonly LOCK_KEY = 'loops:trigger-scheduler:lock';
  private readonly LOCK_TTL_SEC = 55; // Slightly less than the 60s interval

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly loopsService: LoopsService,
    private readonly store: LoopsFileStoreService,
    @Optional() private readonly redis?: RedisService,
  ) {
    super();
  }

  async process(
    job: Job<{ type: 'tick' }, { fired: number; skipped: number; errors: number }, string>,
  ): Promise<{ fired: number; skipped: number; errors: number }> {
    const { type = 'tick' } = job.data;

    if (type !== 'tick') {
      return { fired: 0, skipped: 0, errors: 0 };
    }

    // Distributed lock: only one scheduler instance runs at a time
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.info('[TriggerScheduler] Another instance holds the lock — skipping tick');
      return { fired: 0, skipped: 0, errors: 0 };
    }

    try {
      return await this.processTick();
    } finally {
      await this.releaseLock();
    }
  }

  private async processTick(): Promise<{ fired: number; skipped: number; errors: number }> {
    const now = new Date();
    const triggers = this.store.listScheduleTriggers().filter((t) => t.status === 'active');

    if (triggers.length === 0) {
      return { fired: 0, skipped: 0, errors: 0 };
    }

    let fired = 0;
    let skipped = 0;
    let errors = 0;

    for (const trigger of triggers) {
      // Check if trigger is due
      if (!trigger.nextRunAt) {
        // Compute next run time if not set
        const nextRun = this.computeNextRun(trigger.cronExpression);
        if (nextRun) {
          this.store.writeScheduleTrigger({
            ...trigger,
            nextRunAt: nextRun.toISOString(),
            updatedAt: now.toISOString(),
          });
        }
        skipped++;
        continue;
      }

      const nextRunAt = new Date(trigger.nextRunAt);
      if (nextRunAt > now) {
        skipped++;
        continue;
      }

      // Fire the trigger
      try {
        const result = await this.loopsService.fireScheduleTrigger(trigger.id, {
          reason: `Auto-fired by trigger scheduler at ${now.toISOString()}`,
        });

        if (result.created) {
          fired++;
          this.logger.info(
            `[TriggerScheduler] Fired trigger "${trigger.name}" → ${result.issueId}`,
            {
              triggerId: trigger.id,
              issueId: result.issueId,
            },
          );
        } else {
          errors++;
          this.logger.warn(
            `[TriggerScheduler] Trigger "${trigger.name}" failed: ${result.message}`,
            {
              triggerId: trigger.id,
              message: result.message,
            },
          );
        }
      } catch (error) {
        errors++;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[TriggerScheduler] Trigger "${trigger.name}" error: ${message}`, {
          triggerId: trigger.id,
          error: message,
        });
      }
    }

    if (fired > 0 || errors > 0) {
      this.logger.info(
        `[TriggerScheduler] Tick complete: ${fired} fired, ${skipped} skipped, ${errors} errors`,
      );
    }

    return { fired, skipped, errors };
  }

  private computeNextRun(cronExpression: string): Date | null {
    try {
      const now = new Date();
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length < 5) return null;

      const next = new Date(now);
      if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        // Daily: "M H * * *"
        const hour = parseInt(parts[1], 10);
        const minute = parseInt(parts[0], 10);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        return next;
      } else if (parts[4] !== '*' && parts[3] === '*') {
        // Weekly: "M H * * D"
        const targetDay = parseInt(parts[4], 10);
        const hour = parseInt(parts[1], 10);
        const minute = parseInt(parts[0], 10);
        next.setHours(hour, minute, 0, 0);
        const currentDay = next.getDay() || 7;
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0 && next <= now) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
        return next;
      }
      // Default: hourly
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // Distributed lock via Redis
  // =========================================================================

  private async acquireLock(): Promise<boolean> {
    if (!this.redis) return true; // No Redis → single instance, always allow
    try {
      // SET NX (only if not exists) with TTL
      const result = await this.redis.set(this.LOCK_KEY, new Date().toISOString(), {
        EX: this.LOCK_TTL_SEC,
        NX: true,
      } as Parameters<RedisService['set']>[2]);
      return result === 'OK' || result === true;
    } catch {
      return true; // Redis failure → allow execution (degraded mode)
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.LOCK_KEY);
    } catch {
      // Best effort
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    // Tick completed — silent unless there were fires
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`[TriggerScheduler] Tick failed: ${error.message}`, {
      jobId: job?.id,
      error: error.message,
    });
  }
}
