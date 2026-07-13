import { LoopsAdvanceStatusService } from './loops-advance-status.service';
import { firstValueFrom, take } from 'rxjs';

function createRedis() {
  const values = new Map<string, string>();
  return {
    values,
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
      return 'OK';
    }),
  };
}

describe('LoopsAdvanceStatusService', () => {
  it('recovers a queued job state from Redis in a new worker instance', async () => {
    const redis = createRedis();
    const firstWorker = new LoopsAdvanceStatusService(redis as never);

    await firstWorker.record({
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'queued',
      attempt: 0,
    });

    const recoveredWorker = new LoopsAdvanceStatusService(redis as never);
    await expect(recoveredWorker.get('issue-1')).resolves.toMatchObject({
      jobId: 'advance:issue-1',
      status: 'queued',
      attempt: 0,
    });
  });

  it('marks a stalled job as retrying through its persisted job mapping', async () => {
    const redis = createRedis();
    const service = new LoopsAdvanceStatusService(redis as never);
    await service.record({
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'active',
      attempt: 1,
      updatedAt: '2026-07-13T00:00:00.000Z',
    });

    await service.markStalled('advance:issue-1');

    await expect(service.get('issue-1')).resolves.toMatchObject({
      status: 'retrying',
      attempt: 1,
    });
    await expect(service.get('issue-1')).resolves.not.toMatchObject({
      updatedAt: '2026-07-13T00:00:00.000Z',
    });
  });

  it('does not move a completed job back to retrying for a delayed stalled event', async () => {
    const redis = createRedis();
    const service = new LoopsAdvanceStatusService(redis as never);
    await service.record({
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'completed',
      attempt: 2,
    });

    await service.markStalled('advance:issue-1');

    await expect(service.get('issue-1')).resolves.toMatchObject({
      status: 'completed',
      attempt: 2,
    });
  });

  it('emits the latest persisted state immediately for an SSE subscriber', async () => {
    const redis = createRedis();
    const service = new LoopsAdvanceStatusService(redis as never);
    await service.record({
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'active',
      attempt: 1,
    });

    await expect(firstValueFrom(service.watch('issue-1').pipe(take(1)))).resolves.toMatchObject({
      jobId: 'advance:issue-1',
      status: 'active',
    });
  });
});
