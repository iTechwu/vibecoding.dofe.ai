import { ServiceUnavailableException } from '@nestjs/common';
import { loopsAdvanceJobId, LoopsAdvanceQueueService } from './loops-advance-queue.service';

describe('LoopsAdvanceQueueService', () => {
  it('creates a deterministic BullMQ-safe job ID for every issue ID', () => {
    expect(loopsAdvanceJobId('tenant:issue-1')).toBe('advance-dGVuYW50Omlzc3VlLTE');
    expect(loopsAdvanceJobId('tenant:issue-1')).not.toContain(':');
  });

  it('enqueues one retryable advance job per issue', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'advance-issue-1' });
    const record = jest.fn();
    const service = new LoopsAdvanceQueueService({ record } as never, { add } as never);

    await expect(service.enqueue('issue-1')).resolves.toEqual({ jobId: 'advance-issue-1' });
    expect(record).toHaveBeenCalledWith({
      jobId: 'advance-aXNzdWUtMQ',
      issueId: 'issue-1',
      status: 'queued',
      attempt: 0,
    });
    expect(add).toHaveBeenCalledWith(
      'advance',
      { issueId: 'issue-1' },
      expect.objectContaining({
        jobId: 'advance-aXNzdWUtMQ',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it('fails closed when the advance queue is unavailable', async () => {
    const service = new LoopsAdvanceQueueService({ record: jest.fn() } as never, undefined);

    await expect(service.enqueue('issue-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
