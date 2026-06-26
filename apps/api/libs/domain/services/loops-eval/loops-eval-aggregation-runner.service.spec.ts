import { LoopsEvalAggregationRunnerService } from './loops-eval-aggregation-runner.service';

describe('LoopsEvalAggregationRunnerService', () => {
  function buildRunner(opts: {
    evidencePort?: { collectEvalEvidence: jest.Mock; collectLoopBenchInputs: jest.Mock };
    worker?: { computeAggregation: jest.Mock; cacheHealth?: jest.Mock };
    db?: { upsert: jest.Mock };
  }) {
    const evalService = {
      runEvalAggregationWorker: jest.fn().mockImplementation(async (input) => {
        const { suites } = await input.evidencePort.collectEvalEvidence();
        const flat = suites.map((s: { id: string; summary: { total: number } }) => ({
          suiteId: s.id,
          totalChecks: s.summary.total,
        }));
        const aggs = input.computeAggregation(flat, input.period ?? '30d');
        let persisted = 0;
        if (input.persistAggregation) {
          for (const agg of aggs) {
            if (await input.persistAggregation(agg, input.period ?? '30d')) persisted++;
          }
        }
        let cachedInRedis = false;
        if (input.warmCache) {
          for (const agg of aggs) await input.warmCache(agg, input.period ?? '30d');
          cachedInRedis = aggs.length > 0;
        }
        return {
          processed: aggs.length,
          persisted,
          cachedInRedis,
          period: input.period ?? '30d',
          generatedAt: '2026-06-27T00:00:00.000Z',
        };
      }),
    };
    const runner = new LoopsEvalAggregationRunnerService(
      evalService as never,
      opts.worker as never,
      opts.db as never,
      opts.evidencePort as never,
    );
    return { runner, evalService };
  }

  const suite = { id: 's1', summary: { total: 3 } };
  const evidencePort = () => ({
    collectEvalEvidence: jest.fn().mockResolvedValue({ suites: [suite], runs: [] }),
    collectLoopBenchInputs: jest.fn(),
  });
  const oneAgg = [
    {
      suiteId: 's1',
      tenantId: 'default',
      workspaceId: 'default',
      totalChecks: 3,
      capturedAt: 'now',
      period: '30d',
    },
  ];

  it('persists + warms cache through injected db/worker when evidence port returns suites', async () => {
    const worker = {
      computeAggregation: jest.fn().mockReturnValue(oneAgg),
      setCachedAggregation: jest.fn().mockResolvedValue(undefined),
    };
    const db = { upsert: jest.fn().mockResolvedValue(undefined) };
    const { runner } = buildRunner({ evidencePort: evidencePort(), worker, db });

    const result = await runner.runAggregation({ tenantId: 't1', period: '30d' });

    expect(result.processed).toBe(1);
    expect(result.persisted).toBe(1);
    expect(result.cachedInRedis).toBe(true);
    expect(db.upsert).toHaveBeenCalledTimes(1);
    expect(worker.computeAggregation).toHaveBeenCalled();
    expect(worker.setCachedAggregation).toHaveBeenCalledTimes(1);
  });

  it('processes + warms cache but skips persistence when db is absent', async () => {
    const worker = {
      computeAggregation: jest.fn().mockReturnValue(oneAgg),
      setCachedAggregation: jest.fn().mockResolvedValue(undefined),
    };
    const { runner } = buildRunner({ evidencePort: evidencePort(), worker });

    const result = await runner.runAggregation({ period: '30d' });

    expect(result.processed).toBe(1);
    expect(result.persisted).toBe(0);
    expect(result.cachedInRedis).toBe(true);
  });

  it('processes nothing when the aggregation worker is absent (compute returns [])', async () => {
    const { runner } = buildRunner({ evidencePort: evidencePort() });

    const result = await runner.runAggregation({ period: '7d' });

    expect(result.processed).toBe(0);
    expect(result.persisted).toBe(0);
    expect(result.cachedInRedis).toBe(false);
  });

  it('uses the empty-evidence fallback when no evidence port is wired', async () => {
    const worker = { computeAggregation: jest.fn().mockReturnValue([]) };
    const { runner } = buildRunner({ worker });

    const result = await runner.runAggregation({});

    expect(result.processed).toBe(0);
    expect(result.persisted).toBe(0);
  });

  it('cacheHealth delegates to the aggregation worker when present', async () => {
    const worker = {
      computeAggregation: jest.fn(),
      cacheHealth: jest
        .fn()
        .mockResolvedValue({ available: true, cachedKeys: -1, message: 'Redis responsive' }),
    };
    const { runner } = buildRunner({ worker });
    await expect(runner.cacheHealth()).resolves.toEqual(
      expect.objectContaining({ available: true }),
    );
  });

  it('cacheHealth reports not-configured when worker is absent', async () => {
    const { runner } = buildRunner({});
    await expect(runner.cacheHealth()).resolves.toEqual(
      expect.objectContaining({ available: false }),
    );
  });
});
