import { LoopsEvalService } from './loops-eval.service';
import type {
  EvalHistoricalBaselineSnapshot,
  EvalRun,
  EvalSuite,
  LoopBenchTrendSnapshot,
  LoopCostResponse,
  LoopLearning,
} from '@repo/contracts';

describe('LoopsEvalService worker orchestration', () => {
  let service: LoopsEvalService;

  beforeEach(() => {
    service = new LoopsEvalService();
  });

  function buildSuite(overrides: Partial<EvalSuite> = {}): EvalSuite {
    return {
      id: 'delivery-readiness',
      name: 'Delivery Readiness',
      scope: 'workspace',
      version: 1,
      capturedAt: '2026-06-26T00:00:00.000Z',
      checks: [],
      summary: { total: 6, passed: 4, attention: 1, blocked: 1, passRate: 66 },
      ...overrides,
    } as EvalSuite;
  }

  function buildBaseline(
    overrides: Partial<EvalHistoricalBaselineSnapshot> = {},
  ): EvalHistoricalBaselineSnapshot {
    return {
      id: 'eval-baseline-prev',
      suiteId: 'delivery-readiness',
      blueprintId: 'default',
      baselineVersion: 'default-v1:delivery-readiness:1',
      capturedAt: '2026-06-25T00:00:00.000Z',
      runCount: 2,
      averageScore: 70,
      passRate: 70,
      ...overrides,
    };
  }

  describe('runEvalTrendWorker', () => {
    it('computes baselines from runs + history and appends snapshots', async () => {
      const runs: EvalRun[] = [
        {
          id: 'eval-run-1',
          suiteId: 'delivery-readiness',
          loopId: 'issue-1',
          targetRef: 'issue-1',
          blueprintId: 'default',
          status: 'passed',
          score: 80,
          checkResults: [],
          evidenceRefs: [],
          runAt: '2026-06-26T00:00:00.000Z',
        } as EvalRun,
      ];
      const appended: EvalHistoricalBaselineSnapshot[] = [];
      const evidencePort = {
        collectEvalEvidence: jest.fn().mockResolvedValue({
          suites: [buildSuite()],
          runs,
        }),
        collectLoopBenchInputs: jest.fn(),
      };
      const storePort = {
        readEvalTrendHistory: jest.fn().mockResolvedValue([buildBaseline()]),
        appendEvalTrendSnapshots: jest.fn().mockImplementation(async (snapshots) => {
          appended.push(...snapshots);
          return snapshots;
        }),
        readLoopBenchTrendHistory: jest.fn(),
        appendLoopBenchTrendSnapshot: jest.fn(),
      };

      const result = await service.runEvalTrendWorker({ evidencePort, storePort });

      expect(result.snapshotCount).toBe(1);
      expect(result.baselines[0]).toEqual(
        expect.objectContaining({
          suiteId: 'delivery-readiness',
          blueprintId: 'default',
          runCount: 1,
          previousAverageScore: 70,
        }),
      );
      expect(storePort.appendEvalTrendSnapshots).toHaveBeenCalledTimes(1);
      expect(appended).toHaveLength(1);
    });

    it('returns zero snapshots when no runs are supplied', async () => {
      const evidencePort = {
        collectEvalEvidence: jest.fn().mockResolvedValue({ suites: [buildSuite()], runs: [] }),
        collectLoopBenchInputs: jest.fn(),
      };
      const storePort = {
        readEvalTrendHistory: jest.fn().mockResolvedValue([]),
        appendEvalTrendSnapshots: jest.fn().mockResolvedValue([]),
        readLoopBenchTrendHistory: jest.fn(),
        appendLoopBenchTrendSnapshot: jest.fn(),
      };

      const result = await service.runEvalTrendWorker({ evidencePort, storePort });
      expect(result.snapshotCount).toBe(0);
      expect(result.baselines).toEqual([]);
      expect(storePort.appendEvalTrendSnapshots).toHaveBeenCalledWith([]);
    });
  });

  describe('runLoopBenchTrendWorker', () => {
    function buildPrevSnapshot(
      overrides: Partial<LoopBenchTrendSnapshot> = {},
    ): LoopBenchTrendSnapshot {
      return {
        id: 'loop-bench-prev',
        capturedAt: '2026-06-25T00:00:00.000Z',
        artifactRef: '.loops/bench-trends/prev.json',
        loopCount: 3,
        metrics: {
          firstPassReviewRate: 50,
          browserQaRegressionRate: 10,
          secondOpinionConflictRate: 5,
          releaseBlockerRate: 20,
          runtimeViolationRate: 0,
          learningReuseRate: 30,
          canaryPassRate: 80,
        },
        ...overrides,
      } as LoopBenchTrendSnapshot;
    }

    it('appends a snapshot with deltas when history exists', async () => {
      const cost: LoopCostResponse = {
        totalTokens: 0,
        totalCalls: 0,
        tripped: false,
        loops: [],
      } as never;
      const learnings: LoopLearning[] = [];
      const appended: LoopBenchTrendSnapshot[] = [];
      const evidencePort = {
        collectEvalEvidence: jest.fn(),
        collectLoopBenchInputs: jest
          .fn()
          .mockResolvedValue({ list: [], cost, recentLearnings: learnings }),
      };
      const storePort = {
        readEvalTrendHistory: jest.fn(),
        appendEvalTrendSnapshots: jest.fn(),
        readLoopBenchTrendHistory: jest.fn().mockResolvedValue([buildPrevSnapshot()]),
        appendLoopBenchTrendSnapshot: jest.fn().mockImplementation(async (snapshot) => {
          appended.push(snapshot);
          return [buildPrevSnapshot(), snapshot];
        }),
      };

      const result = await service.runLoopBenchTrendWorker({ evidencePort, storePort });

      expect(result.snapshot.metrics).toEqual(
        expect.objectContaining({ firstPassReviewRate: expect.any(Number) }),
      );
      expect(result.snapshot.deltas).toBeDefined();
      expect(result.snapshot.previousMetrics).toEqual(buildPrevSnapshot().metrics);
      expect(result.historyCount).toBe(2);
      expect(appended).toHaveLength(1);
      expect(appended[0].artifactRef).toMatch(/^\.loops\/bench-trends\//);
    });

    it('omits deltas on the first snapshot (no history)', async () => {
      const evidencePort = {
        collectEvalEvidence: jest.fn(),
        collectLoopBenchInputs: jest.fn().mockResolvedValue({ list: [] }),
      };
      const storePort = {
        readEvalTrendHistory: jest.fn(),
        appendEvalTrendSnapshots: jest.fn(),
        readLoopBenchTrendHistory: jest.fn().mockResolvedValue([]),
        appendLoopBenchTrendSnapshot: jest.fn().mockResolvedValue([]),
      };

      const result = await service.runLoopBenchTrendWorker({ evidencePort, storePort });
      expect(result.snapshot.deltas).toBeUndefined();
      expect(result.snapshot.previousMetrics).toBeUndefined();
      expect(result.historyCount).toBe(0);
    });
  });

  describe('runEvalAggregationWorker', () => {
    it('flattens suites, persists to DB, warms cache, and reports counts', async () => {
      const evidencePort = {
        collectEvalEvidence: jest.fn().mockResolvedValue({ suites: [buildSuite()], runs: [] }),
        collectLoopBenchInputs: jest.fn(),
      };
      const persist = jest.fn().mockResolvedValue(true);
      const warm = jest.fn().mockResolvedValue(undefined);
      const compute = jest.fn().mockImplementation((flat, period) =>
        flat.map((item) => ({
          tenantId: item.tenantId,
          workspaceId: item.workspaceId,
          suiteId: item.suiteId,
          totalChecks: item.totalChecks,
          passedChecks: item.passedChecks,
          failedChecks: item.failedChecks,
          blockedChecks: item.blockedChecks,
          passRate: item.passRate,
          averageScore: item.averageScore,
          loopCount: item.loopCount,
          period,
          capturedAt: '2026-06-26T00:00:00.000Z',
        })),
      );
      const logSink = { log: jest.fn() };

      const result = await service.runEvalAggregationWorker({
        tenantId: 'tenant-1',
        period: '30d',
        evidencePort,
        computeAggregation: compute,
        persistAggregation: persist,
        warmCache: warm,
        logSink,
      });

      expect(compute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ suiteId: 'delivery-readiness', tenantId: 'tenant-1' }),
        ]),
        '30d',
      );
      expect(result.processed).toBe(1);
      expect(result.persisted).toBe(1);
      expect(result.cachedInRedis).toBe(true);
      expect(result.period).toBe('30d');
      expect(persist).toHaveBeenCalledTimes(1);
      expect(warm).toHaveBeenCalledTimes(1);
      expect(logSink.log).toHaveBeenCalledWith('info', expect.stringContaining('persisted'));
    });

    it('skips persistence and cache when ports are absent', async () => {
      const evidencePort = {
        collectEvalEvidence: jest.fn().mockResolvedValue({ suites: [buildSuite()], runs: [] }),
        collectLoopBenchInputs: jest.fn(),
      };
      const compute = jest.fn().mockReturnValue([
        {
          tenantId: 'default',
          workspaceId: 'default',
          suiteId: 'delivery-readiness',
          totalChecks: 6,
          passedChecks: 4,
          failedChecks: 1,
          blockedChecks: 1,
          passRate: 66,
          averageScore: 66,
          loopCount: 2,
          period: '30d',
          capturedAt: '2026-06-26T00:00:00.000Z',
        },
      ]);

      const result = await service.runEvalAggregationWorker({
        evidencePort,
        computeAggregation: compute,
      });

      expect(result.processed).toBe(1);
      expect(result.persisted).toBe(0);
      expect(result.cachedInRedis).toBe(false);
    });

    it('continues and logs when persistence throws', async () => {
      const evidencePort = {
        collectEvalEvidence: jest.fn().mockResolvedValue({ suites: [buildSuite()], runs: [] }),
        collectLoopBenchInputs: jest.fn(),
      };
      const compute = jest.fn().mockReturnValue([
        {
          tenantId: 'default',
          workspaceId: 'default',
          suiteId: 'delivery-readiness',
          totalChecks: 1,
          passedChecks: 0,
          failedChecks: 0,
          blockedChecks: 0,
          passRate: 0,
          averageScore: 0,
          loopCount: 0,
          period: '30d',
          capturedAt: '2026-06-26T00:00:00.000Z',
        },
      ]);
      const logSink = { log: jest.fn() };

      const result = await service.runEvalAggregationWorker({
        evidencePort,
        computeAggregation: compute,
        persistAggregation: jest.fn().mockRejectedValue(new Error('db down')),
        logSink,
      });

      expect(result.persisted).toBe(0);
      expect(logSink.log).toHaveBeenCalledWith(
        'error',
        '[EvalAgg] DB persistence failed',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });
  });
});
