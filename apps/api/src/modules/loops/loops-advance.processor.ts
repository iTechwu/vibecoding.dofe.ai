import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { LoopsService } from './loops.service';
import { LOOPS_ADVANCE_QUEUE, type LoopsAdvanceJobData } from './loops-advance-queue.service';
import { LoopsAdvanceStatusService } from './loops-advance-status.service';

@Processor(LOOPS_ADVANCE_QUEUE, {
  concurrency: 1,
  limiter: { max: 12, duration: 60_000 },
})
export class LoopsAdvanceProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly loopsService: LoopsService,
    private readonly statusService: LoopsAdvanceStatusService,
  ) {
    super();
  }

  async process(
    job: Job<LoopsAdvanceJobData, { issueId: string; phase: string; status: string }, string>,
  ): Promise<{ issueId: string; phase: string; status: string }> {
    const { issueId } = job.data;
    const jobId = String(job.id);
    const attempt = job.attemptsMade + 1;
    await this.statusService.record({ jobId, issueId, status: 'active', attempt });
    this.logger.info('[LoopsAdvance] Processing queued advance', {
      jobId,
      issueId,
      attempt,
    });

    const detail = await this.loopsService.advance(issueId);
    const result = {
      issueId,
      phase: detail.state.phase,
      status: detail.issue.status,
    };
    await this.statusService.record({
      jobId,
      issueId,
      status: 'completed',
      attempt,
      phase: result.phase,
      issueStatus: result.status,
    });
    this.logger.info('[LoopsAdvance] Queued advance completed', { jobId, ...result });
    return result;
  }

  @OnWorkerEvent('stalled')
  async onStalled(jobId: string): Promise<void> {
    await this.statusService.markStalled(jobId);
    this.logger.warn?.('[LoopsAdvance] Worker stalled; BullMQ will recover the job', { jobId });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<LoopsAdvanceJobData> | undefined, _error: Error): Promise<void> {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const status = job.attemptsMade < attempts ? 'retrying' : 'failed';
    await this.statusService.record({
      jobId: String(job.id),
      issueId: job.data.issueId,
      status,
      attempt: job.attemptsMade,
    });
    this.logger[status === 'failed' ? 'error' : 'warn']?.('[LoopsAdvance] Job attempt failed', {
      jobId: job.id,
      issueId: job.data.issueId,
      attempt: job.attemptsMade,
      status,
    });
  }
}
