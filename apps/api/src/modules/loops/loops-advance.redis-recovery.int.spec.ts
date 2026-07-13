import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { LoopsAdvanceStatusService } from './loops-advance-status.service';

const redisUrl = process.env.REDIS_URL;
const describeRedis =
  process.env.LOOPS_REDIS_INTEGRATION === '1' && redisUrl ? describe : describe.skip;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  return {
    promise: new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    }),
    resolve,
    reject,
  };
}

async function within<T>(promise: Promise<T>, timeoutMs: number, description: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out waiting for ${description}`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

describeRedis('Loops advance Redis recovery integration', () => {
  let redis: Redis;
  const issueId = `issue-redis-recovery-${Date.now()}`;
  const jobId = `advance:${issueId}`;

  function createStatusService() {
    return new LoopsAdvanceStatusService({
      get: (key: string) => redis.get(key),
      set: (key: string, value: string, options: { EX: number }) =>
        redis.set(key, value, 'EX', options.EX),
    } as never);
  }

  beforeAll(async () => {
    redis = new Redis(redisUrl!, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
    await redis.ping();
  });

  afterAll(async () => {
    await redis.del(`loops:advance:status:${issueId}`, `loops:advance:job:${jobId}`);
    await redis.quit();
  });

  it('recovers the active job state after a worker replacement and marks it retrying', async () => {
    await createStatusService().record({
      jobId,
      issueId,
      status: 'active',
      attempt: 1,
    });

    const recoveredWorker = createStatusService();
    await recoveredWorker.markStalled(jobId);

    await expect(recoveredWorker.get(issueId)).resolves.toMatchObject({
      jobId,
      issueId,
      status: 'retrying',
      attempt: 1,
    });
  });

  it('reclaims an active job after a worker force-close and keeps the recovery status in Redis', async () => {
    const crashIssueId = `issue-worker-crash-${Date.now()}`;
    const crashJobId = `advance-${crashIssueId}`;
    const queueName = `loops-advance-recovery-${Date.now()}`;
    const queueRedis = new Redis(redisUrl!, { connectTimeout: 3000, maxRetriesPerRequest: null });
    const queue = new Queue(queueName, { connection: queueRedis });
    const claimed = deferred<void>();
    const stalled = deferred<void>();
    const reprocessed = deferred<void>();
    let recoveredStatus: Awaited<ReturnType<LoopsAdvanceStatusService['get']>>;
    let crashedWorker: Worker | undefined;
    let recoveryWorker: Worker | undefined;

    try {
      const initialStatusService = createStatusService();
      crashedWorker = new Worker(
        queueName,
        async () => {
          await initialStatusService.record({
            jobId: crashJobId,
            issueId: crashIssueId,
            status: 'active',
            attempt: 1,
          });
          claimed.resolve();
          await new Promise<void>(() => undefined);
        },
        {
          connection: new Redis(redisUrl!, { connectTimeout: 3000, maxRetriesPerRequest: null }),
          lockDuration: 500,
          stalledInterval: 100,
        },
      );

      await queue.add('advance', { issueId: crashIssueId }, { jobId: crashJobId, attempts: 2 });
      await within(claimed.promise, 5000, 'the initial worker to claim the job');
      await crashedWorker.close(true);
      crashedWorker = undefined;

      const recoveryStatusService = createStatusService();
      recoveryWorker = new Worker(
        queueName,
        async (job) => {
          await stalled.promise;
          reprocessed.resolve();
          await recoveryStatusService.record({
            jobId: String(job.id),
            issueId: crashIssueId,
            status: 'completed',
            attempt: job.attemptsMade + 1,
          });
          return { issueId: crashIssueId };
        },
        {
          autorun: false,
          connection: new Redis(redisUrl!, { connectTimeout: 3000, maxRetriesPerRequest: null }),
          lockDuration: 500,
          stalledInterval: 100,
        },
      );
      recoveryWorker.on('stalled', (stalledJobId) => {
        if (stalledJobId !== crashJobId) return;
        void recoveryStatusService
          .markStalled(stalledJobId)
          .then((status) => {
            recoveredStatus = status;
            stalled.resolve();
          })
          .catch(stalled.reject);
      });
      void recoveryWorker.run();

      await within(stalled.promise, 10_000, 'BullMQ to recover the stalled job');
      await within(reprocessed.promise, 5000, 'the replacement worker to reclaim the job');
      expect(recoveredStatus).toMatchObject({
        jobId: crashJobId,
        issueId: crashIssueId,
        status: 'retrying',
        attempt: 1,
      });
    } finally {
      await crashedWorker?.close(true);
      await recoveryWorker?.close(true);
      await queue.obliterate({ force: true });
      await queue.close();
      await queueRedis.quit();
      await redis.del(`loops:advance:status:${crashIssueId}`, `loops:advance:job:${crashJobId}`);
    }
  });
});
