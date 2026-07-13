import { Injectable } from '@nestjs/common';
import { RedisService } from '@dofe/infra-redis';
import { LoopAdvanceJobStatusSchema, type LoopAdvanceJobStatus } from '@repo/contracts';
import { from, timer, type Observable } from 'rxjs';
import { concatMap, distinctUntilChanged, filter } from 'rxjs/operators';

export type { LoopAdvanceJobStatus } from '@repo/contracts';
export type LoopAdvanceJobStatusInput = Omit<LoopAdvanceJobStatus, 'updatedAt'> & {
  updatedAt?: string;
};

@Injectable()
export class LoopsAdvanceStatusService {
  private readonly ttlSeconds = 86_400;

  constructor(private readonly redis: RedisService) {}

  async record(input: LoopAdvanceJobStatusInput): Promise<LoopAdvanceJobStatus> {
    const status = LoopAdvanceJobStatusSchema.parse({
      ...input,
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    });
    await this.redis.set(this.issueKey(status.issueId), JSON.stringify(status), {
      EX: this.ttlSeconds,
    });
    await this.redis.set(this.jobKey(status.jobId), status.issueId, { EX: this.ttlSeconds });
    return status;
  }

  async get(issueId: string): Promise<LoopAdvanceJobStatus | undefined> {
    const raw = await this.redis.get(this.issueKey(issueId));
    if (typeof raw !== 'string') return undefined;
    try {
      const parsed = LoopAdvanceJobStatusSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  async markStalled(jobId: string): Promise<LoopAdvanceJobStatus | undefined> {
    const issueId = await this.redis.get(this.jobKey(jobId));
    if (typeof issueId !== 'string') return undefined;
    const current = await this.get(issueId);
    if (!current) return undefined;
    if (current.status === 'completed' || current.status === 'failed') return current;
    const { updatedAt: _updatedAt, ...input } = current;
    return this.record({ ...input, status: 'retrying' });
  }

  watch(issueId: string): Observable<LoopAdvanceJobStatus> {
    return timer(0, 1000).pipe(
      concatMap(() => from(this.get(issueId))),
      filter((status): status is LoopAdvanceJobStatus => status !== undefined),
      distinctUntilChanged((left, right) => JSON.stringify(left) === JSON.stringify(right)),
    );
  }

  private issueKey(issueId: string) {
    return `loops:advance:status:${issueId}`;
  }

  private jobKey(jobId: string) {
    return `loops:advance:job:${jobId}`;
  }
}
