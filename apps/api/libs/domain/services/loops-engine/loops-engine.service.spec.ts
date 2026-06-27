import { BadRequestException } from '@nestjs/common';
import type { LoopDetail, LoopIssue, LoopShard, LoopSpec, LoopStateItem } from '@repo/contracts';
import { LoopsEngineService } from './loops-engine.service';

// `readLoopsRuntimeConfig` reads `.loops/config.yaml` from disk; stub it so the
// scheduler tests are deterministic. The engine only uses `LoopsFileStoreService`
// as a constructor *type*, so a stub class satisfies the import at runtime.
jest.mock('@app/services/loops-store', () => ({
  LoopsFileStoreService: class {},
  readLoopsRuntimeConfig: jest.fn(),
}));

import { readLoopsRuntimeConfig } from '@app/services/loops-store';

const mockedReadRuntimeConfig = jest.mocked(readLoopsRuntimeConfig);

function buildDetail(overrides: Partial<LoopDetail> = {}): LoopDetail {
  return {
    issue: { id: 'issue-20260627-aaaaaaaa', status: 'OPEN', targetRepo: '.' } as LoopIssue,
    state: {
      issueId: 'issue-20260627-aaaaaaaa',
      phase: 'PHASE_1_SPEC',
      round: 1,
      specVersion: 'v0',
      shardsTotal: 0,
      shardsDone: 0,
      shardsInProgress: 0,
      reloopCount: 0,
      costTokens: 0,
      costCalls: 0,
      updated: '2026-06-27T00:00:00.000Z',
      paused: false,
    },
    shards: [],
    testRecords: [],
    reviewRecords: [],
    implementationRecords: [],
    annotations: [],
    ...overrides,
  } as LoopDetail;
}

function buildStoreMock() {
  return {
    enforceCostGuard: jest.fn().mockImplementation((state: LoopStateItem) => state),
    writeSpec: jest.fn(),
    writeShards: jest.fn(),
  };
}

function buildAdapterMock() {
  return {
    plan: jest.fn().mockResolvedValue({ id: 'spec-1', body: 'planned spec body' } as LoopSpec),
    decompose: jest.fn().mockResolvedValue({ shards: [{ id: 'shard-1' }], annotations: [] }),
    designTests: jest.fn().mockResolvedValue({ suites: [] }),
  };
}

describe('LoopsEngineService', () => {
  describe('pure predicates / derivation', () => {
    const engine = new LoopsEngineService();

    it('isTerminal is true for CLOSED issue / phase / finalized', () => {
      expect(engine.isTerminal(buildDetail({ issue: { status: 'CLOSED' } as LoopIssue }))).toBe(
        true,
      );
      expect(engine.isTerminal(buildDetail({ state: { phase: 'CLOSED' } as LoopStateItem }))).toBe(
        true,
      );
      expect(engine.isTerminal(buildDetail({ state: { finalized: true } as LoopStateItem }))).toBe(
        true,
      );
      expect(engine.isTerminal(buildDetail())).toBe(false);
    });

    it('nextSpecVersion bumps v0 → v1 → v2', () => {
      expect(engine.nextSpecVersion('v0')).toBe('v1');
      expect(engine.nextSpecVersion('v1')).toBe('v2');
    });

    it('nextResumePhase respects shard/spec state', () => {
      expect(engine.nextResumePhase({ shardsTotal: 1 } as LoopStateItem)).toBe('PHASE_4_IMPLEMENT');
      expect(engine.nextResumePhase({ shardsTotal: 0, specVersion: 'v0' } as LoopStateItem)).toBe(
        'PHASE_1_SPEC',
      );
      expect(engine.nextResumePhase({ shardsTotal: 0, specVersion: 'v1' } as LoopStateItem)).toBe(
        'PHASE_2_REVIEW',
      );
    });
  });

  describe('applyCostGuard', () => {
    it('bumps cost counters and delegates to store.enforceCostGuard', async () => {
      const store = buildStoreMock();
      const engine = new LoopsEngineService(store as never);
      const state = buildDetail().state;

      await engine.applyCostGuard(state, { calls: 2, tokens: 100 });

      expect(store.enforceCostGuard).toHaveBeenCalledWith(
        expect.objectContaining({ costCalls: 2, costTokens: 100 }),
      );
    });

    it('defaults to one call / zero tokens', async () => {
      const store = buildStoreMock();
      const engine = new LoopsEngineService(store as never);
      await engine.applyCostGuard(buildDetail().state);
      expect(store.enforceCostGuard).toHaveBeenCalledWith(
        expect.objectContaining({ costCalls: 1, costTokens: 0 }),
      );
    });
  });

  describe('generateSpec', () => {
    it('plans a v1 DRAFT spec and writes it with a cost-guarded PHASE_2_REVIEW state', async () => {
      const store = buildStoreMock();
      const engine = new LoopsEngineService(store as never);
      const adapter = buildAdapterMock();
      const detail = buildDetail();

      await engine.generateSpec(detail, adapter as never);

      expect(adapter.plan).toHaveBeenCalledWith(detail.issue, expect.any(String));
      const [issue, spec, state] = store.writeSpec.mock.calls[0];
      expect(issue).toBe(detail.issue);
      expect(spec).toEqual(
        expect.objectContaining({
          id: 'spec-1',
          version: 'v1',
          status: 'DRAFT',
          body: 'planned spec body',
        }),
      );
      expect(state).toEqual(
        expect.objectContaining({ phase: 'PHASE_2_REVIEW', specVersion: 'v1' }),
      );
    });

    it('appends a revision note and re-ids the spec for a non-v1 version', async () => {
      const store = buildStoreMock();
      const engine = new LoopsEngineService(store as never);
      const adapter = buildAdapterMock();
      const detail = buildDetail({
        spec: { status: 'REVISION_REQUESTED' } as LoopSpec,
        state: { specVersion: 'v1' } as LoopStateItem,
      });

      await engine.generateSpec(detail, adapter as never);

      const [, spec] = store.writeSpec.mock.calls[0];
      expect(spec.version).toBe('v2');
      expect(spec.body).toContain('修订说明');
      expect(spec.id).toBe(`spec-${detail.issue.id.replace('issue-', '')}-v2`);
    });

    it('rejects when a non-revision spec already exists', async () => {
      const engine = new LoopsEngineService(buildStoreMock() as never);
      const detail = buildDetail({ spec: { status: 'DRAFT' } as LoopSpec });
      await expect(engine.generateSpec(detail, buildAdapterMock() as never)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('decompose', () => {
    it('decomposes an approved spec into shards + test matrix and writes PHASE_4_IMPLEMENT', async () => {
      const store = buildStoreMock();
      const engine = new LoopsEngineService(store as never);
      const adapter = buildAdapterMock();
      const detail = buildDetail({
        spec: { status: 'APPROVED' } as LoopSpec,
        state: { phase: 'PHASE_3_DECOMPOSE' } as LoopStateItem,
      });

      const result = await engine.decompose(detail, adapter as never);

      expect(result).toBe(true);
      expect(adapter.decompose).toHaveBeenCalledWith(detail.issue, detail.spec);
      expect(adapter.designTests).toHaveBeenCalled();
      const payload = store.writeShards.mock.calls[0][0];
      expect(payload.state).toEqual(
        expect.objectContaining({ phase: 'PHASE_4_IMPLEMENT', shardsTotal: 1 }),
      );
    });

    it('returns false (no-op) for terminal or already-decomposed loops', async () => {
      const engine = new LoopsEngineService(buildStoreMock() as never);
      const adapter = buildAdapterMock();
      expect(
        await engine.decompose(
          buildDetail({ state: { finalized: true } as LoopStateItem }),
          adapter as never,
        ),
      ).toBe(false);
      expect(
        await engine.decompose(
          buildDetail({ shards: [{ id: 'shard-1' }] as never }),
          adapter as never,
        ),
      ).toBe(false);
    });

    it('rejects when the spec is not approved', async () => {
      const engine = new LoopsEngineService(buildStoreMock() as never);
      await expect(
        engine.decompose(
          buildDetail({ spec: { status: 'DRAFT' } as LoopSpec }),
          buildAdapterMock() as never,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('advance dispatcher', () => {
    const engine = new LoopsEngineService();

    /** Build a port mock that resolves each transition to `next` and records calls. */
    function buildPort(next: LoopDetail) {
      return {
        getDetail: jest.fn().mockResolvedValue(next),
        resumeAndRead: jest.fn().mockResolvedValue(next),
        generateSpec: jest.fn().mockResolvedValue(next),
        decompose: jest.fn().mockResolvedValue(next),
        finalize: jest.fn().mockResolvedValue(next),
        reviewGlobal: jest.fn().mockResolvedValue(next),
        runLoop: jest.fn().mockResolvedValue(next),
        appendAdvanceLimitLog: jest.fn().mockResolvedValue(undefined),
      };
    }

    it('dispatches to generateSpec when spec is missing or REVISION_REQUESTED', async () => {
      const next = buildDetail({ spec: { status: 'DRAFT' } as LoopSpec }); // DRAFT exits loop
      const port = buildPort(buildDetail()); // initial detail has no spec
      port.getDetail.mockResolvedValueOnce(buildDetail()); // no spec
      // generateSpec returns a DRAFT detail so the loop exits on next iteration
      port.generateSpec.mockResolvedValueOnce(next);

      await engine.advance('issue-1', port);

      expect(port.generateSpec).toHaveBeenCalledWith('issue-1');
    });

    it('returns immediately when spec is DRAFT (waiting for human review)', async () => {
      const port = buildPort(buildDetail({ spec: { status: 'DRAFT' } as LoopSpec }));
      const result = await engine.advance('issue-1', port);
      expect(port.runLoop).not.toHaveBeenCalled();
      expect(port.decompose).not.toHaveBeenCalled();
      expect(result.state.phase).toBe('PHASE_1_SPEC');
    });

    it('throws when spec is neither draft nor approved (e.g. REJECTED)', async () => {
      const port = buildPort(buildDetail({ spec: { status: 'REJECTED' } as LoopSpec }));
      await expect(engine.advance('issue-1', port)).rejects.toThrow(BadRequestException);
    });

    it('dispatches to decompose when spec is APPROVED but shards are empty', async () => {
      const port = buildPort(buildDetail({ spec: { status: 'APPROVED' } as LoopSpec, shards: [] }));
      // decompose returns a DRAFT-less terminal-ish detail: give it shards + non-PASS verdict to exit
      port.decompose.mockResolvedValueOnce(
        buildDetail({
          spec: { status: 'APPROVED' } as LoopSpec,
          shards: [{ id: 's1' }] as never,
          state: { phase: 'PHASE_4_IMPLEMENT', globalVerdict: 'NEEDS-WORK' } as LoopStateItem,
        }),
      );
      await engine.advance('issue-1', port);
      expect(port.decompose).toHaveBeenCalledWith('issue-1');
    });

    it('dispatches to finalize when globalVerdict is PASS and not finalized', async () => {
      const port = buildPort(
        buildDetail({
          spec: { status: 'APPROVED' } as LoopSpec,
          shards: [{ id: 's1' }] as never,
          state: { phase: 'PHASE_6_CONVERGE', globalVerdict: 'PASS' } as LoopStateItem,
        }),
      );
      port.finalize.mockResolvedValueOnce(
        buildDetail({ state: { finalized: true, phase: 'CLOSED' } as LoopStateItem }),
      );
      await engine.advance('issue-1', port);
      expect(port.finalize).toHaveBeenCalledWith('issue-1');
    });

    it('dispatches to runLoop for an APPROVED in-progress loop', async () => {
      const port = buildPort(
        buildDetail({
          spec: { status: 'APPROVED' } as LoopSpec,
          shards: [{ id: 's1' }] as never,
          state: { phase: 'PHASE_4_IMPLEMENT' } as LoopStateItem,
        }),
      );
      port.runLoop.mockResolvedValueOnce(
        buildDetail({
          spec: { status: 'APPROVED' } as LoopSpec,
          shards: [{ id: 's1' }] as never,
          state: { phase: 'PHASE_4_IMPLEMENT', globalVerdict: 'NEEDS-WORK' } as LoopStateItem,
        }),
      );
      await engine.advance('issue-1', port);
      expect(port.runLoop).toHaveBeenCalledWith('issue-1');
    });

    it('resumes via resumeAndRead when the loop is paused', async () => {
      const port = buildPort(buildDetail({ state: { paused: true } as LoopStateItem }));
      port.resumeAndRead.mockResolvedValueOnce(
        buildDetail({ spec: { status: 'DRAFT' } as LoopSpec }),
      );
      await engine.advance('issue-1', port);
      expect(port.resumeAndRead).toHaveBeenCalled();
    });

    it('returns the detail without transitions when already CLOSED', async () => {
      const port = buildPort(buildDetail({ state: { phase: 'CLOSED' } as LoopStateItem }));
      await engine.advance('issue-1', port);
      expect(port.runLoop).not.toHaveBeenCalled();
      expect(port.generateSpec).not.toHaveBeenCalled();
    });
  });

  describe('runLoopUnlocked scheduler', () => {
    function buildSchedulerStore() {
      return {
        writeShardProgress: jest.fn(),
        upsertState: jest.fn(),
        appendLog: jest.fn(),
        writeNotification: jest.fn(),
        enforceCostGuard: jest.fn(),
        writeSpec: jest.fn(),
        writeShards: jest.fn(),
      };
    }

    function approvedDetail(shards: LoopShard[]): LoopDetail {
      return buildDetail({
        spec: { status: 'APPROVED' } as LoopSpec,
        shards,
        state: { phase: 'PHASE_4_IMPLEMENT' } as LoopStateItem,
      });
    }

    function shard(id: string, overrides: Partial<LoopShard> = {}): LoopShard {
      return {
        id,
        title: id,
        status: 'TODO',
        dependsOn: [],
        estContext: 100,
        filesHint: [],
        ...overrides,
      } as LoopShard;
    }

    beforeEach(() => {
      mockedReadRuntimeConfig.mockResolvedValue({
        contextBudget: 24000,
        maxParallel: 1,
        maxRetry: 2,
        maxReloop: 3,
        maxShardRedo: 3,
        shardTimeoutSec: 900,
        cost: { tokenCapPerLoop: 5000000, callCapPerLoop: 500 },
        tests: {
          defaultCommands: [],
          regressionCommands: [],
          allowedCommands: [],
          coverageFloor: {},
        },
      });
    });

    it('runs one runnable shard, logs a SCHEDULER_BATCH, and returns the fresh detail', async () => {
      const store = buildSchedulerStore();
      const engine = new LoopsEngineService(store as never);
      const detail = approvedDetail([shard('shard-1')]);
      const fresh = approvedDetail([{ ...shard('shard-1'), status: 'DONE' }]);
      const port = {
        readFreshDetail: jest.fn().mockResolvedValue(fresh),
        runRunnableShard: jest.fn().mockResolvedValue(undefined),
      };

      const result = await engine.runLoopUnlocked('issue-1', detail, port);

      expect(port.runRunnableShard).toHaveBeenCalledWith(
        'issue-1',
        detail,
        expect.objectContaining({ id: 'shard-1' }),
      );
      expect(store.appendLog).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SCHEDULER_BATCH', advanced: 1 }),
      );
      expect(result).toBe(fresh);
    });

    it('converges to PHASE_6_CONVERGE when all shards are already DONE and none runnable', async () => {
      const store = buildSchedulerStore();
      const engine = new LoopsEngineService(store as never);
      const detail = approvedDetail([{ ...shard('shard-1'), status: 'DONE' }]);
      const fresh = { ...detail };
      const port = {
        readFreshDetail: jest.fn().mockResolvedValue(fresh),
        runRunnableShard: jest.fn(),
      };

      await engine.runLoopUnlocked('issue-1', detail, port);

      expect(port.runRunnableShard).not.toHaveBeenCalled();
      expect(store.upsertState).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'PHASE_6_CONVERGE', shardsDone: 1 }),
      );
    });

    it('throws when no shard is runnable and not all are DONE', async () => {
      const store = buildSchedulerStore();
      const engine = new LoopsEngineService(store as never);
      const detail = approvedDetail([{ ...shard('shard-1'), status: 'BLOCKED' }]);
      const port = { readFreshDetail: jest.fn(), runRunnableShard: jest.fn() };

      await expect(engine.runLoopUnlocked('issue-1', detail, port)).rejects.toThrow(
        'No runnable shard is available',
      );
    });

    it('recovers IN_PROGRESS shards to TODO before retrying findRunnableShard', async () => {
      const store = buildSchedulerStore();
      const engine = new LoopsEngineService(store as never);
      const interrupted = shard('shard-1', { status: 'IN_PROGRESS' });
      const detail = approvedDetail([interrupted]);
      const recovered = approvedDetail([shard('shard-1')]); // post-recovery: TODO → runnable
      const port = {
        readFreshDetail: jest.fn().mockResolvedValue(recovered),
        runRunnableShard: jest.fn().mockResolvedValue(undefined),
      };

      await engine.runLoopUnlocked('issue-1', detail, port);

      expect(store.writeShardProgress).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'INTERRUPTED', to: 'TODO', shardId: 'shard-1' }),
      );
      expect(port.runRunnableShard).toHaveBeenCalled();
      expect(store.appendLog).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SCHEDULER_RECOVERED_INTERRUPTED_SHARDS' }),
      );
    });

    it('blocks a shard whose estContext exceeds the context budget', async () => {
      mockedReadRuntimeConfig.mockResolvedValueOnce({
        ...(await mockedReadRuntimeConfig()),
        contextBudget: 50,
      });
      const store = buildSchedulerStore();
      const engine = new LoopsEngineService(store as never);
      const detail = approvedDetail([shard('shard-1', { estContext: 500 })]);
      const fresh = approvedDetail([{ ...shard('shard-1'), status: 'BLOCKED' }]);
      const port = {
        readFreshDetail: jest.fn().mockResolvedValue(fresh),
        runRunnableShard: jest.fn(),
      };

      await engine.runLoopUnlocked('issue-1', detail, port);

      expect(port.runRunnableShard).not.toHaveBeenCalled();
      expect(store.writeShardProgress).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'BLOCKED', shardId: 'shard-1' }),
      );
      expect(store.writeNotification).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'CONTEXT_BUDGET_EXCEEDED' }),
      );
    });

    it('rejects a paused loop or a non-approved spec', async () => {
      const engine = new LoopsEngineService(buildSchedulerStore() as never);
      const port = { readFreshDetail: jest.fn(), runRunnableShard: jest.fn() };
      await expect(
        engine.runLoopUnlocked(
          'issue-1',
          buildDetail({ state: { paused: true } as LoopStateItem }),
          port,
        ),
      ).rejects.toThrow('Paused loop cannot be advanced');
      await expect(
        engine.runLoopUnlocked(
          'issue-1',
          buildDetail({ spec: { status: 'DRAFT' } as LoopSpec }),
          port,
        ),
      ).rejects.toThrow('Approved spec is required');
    });
  });
});
