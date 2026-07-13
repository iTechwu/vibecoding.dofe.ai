import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { LoopsAdvanceStatusService } from './loops-advance-status.service';

export const LOOPS_ADVANCE_QUEUE = 'loops-advance';
export const LOOPS_ADVANCE_JOB = 'advance';

export function loopsAdvanceJobId(issueId: string): string {
  return `advance-${Buffer.from(issueId).toString('base64url')}`;
}

export type LoopsAdvanceJobData = {
  issueId: string;
};

@Injectable()
export class LoopsAdvanceQueueService {
  constructor(
    private readonly statusService: LoopsAdvanceStatusService,
    @Optional()
    @InjectQueue(LOOPS_ADVANCE_QUEUE)
    private readonly queue?: Queue<LoopsAdvanceJobData>,
  ) {}

  async enqueue(issueId: string): Promise<{ jobId: string }> {
    if (!this.queue) {
      throw new ServiceUnavailableException('Loops advance queue is unavailable. Try again later.');
    }

    const jobId = loopsAdvanceJobId(issueId);
    await this.statusService.record({ jobId, issueId, status: 'queued', attempt: 0 });
    const job = await this.queue.add(
      LOOPS_ADVANCE_JOB,
      { issueId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    return { jobId: String(job.id) };
  }
}
