import type {
  LoopAnnotation,
  LoopDetail,
  LoopImplementationRecord,
  LoopIssue,
  LoopReviewRecord,
  LoopShard,
  LoopSpec,
  LoopStateItem,
  LoopTestRecord,
} from '@repo/contracts';
import { LoopsRemoteShardStateAdapter } from './loops-remote-shard-state.adapter';

jest.mock('@app/services/loops-store', () => ({
  LoopsFileStoreService: class {},
  readLoopsRuntimeConfig: jest.fn().mockResolvedValue({
    maxShardRedo: 2,
  }),
}));

function buildDetail(overrides: Partial<LoopDetail> = {}): LoopDetail {
  const issue = {
    id: 'issue-1',
    status: 'OPEN',
    title: 'Issue',
    targetRepo: '/repo',
  } as LoopIssue;
  const state = {
    issueId: issue.id,
    phase: 'PHASE_4_IMPLEMENT',
    round: 1,
    specVersion: 'v1',
    shardsTotal: 1,
    shardsDone: 0,
    shardsInProgress: 1,
    reloopCount: 0,
    costCalls: 0,
    costTokens: 0,
    updated: '2026-06-27T00:00:00.000Z',
  } as LoopStateItem;
  const shard = {
    id: 'shard-1',
    title: 'Shard 1',
    status: 'IMPLEMENTED',
    dependsOn: [],
    estContext: 10,
    filesHint: [],
  } as LoopShard;
  const annotation = {
    target: shard.id,
    location: [],
    implStatus: 'todo',
    testStatus: 'missing',
    verdict: 'unreviewed',
    coverage: 'none',
    notes: '',
  } as LoopAnnotation;
  const implementationRecord = {
    id: 'impl-1',
    issueId: issue.id,
    shardId: shard.id,
    round: 1,
    implementer: 'remote-runner:codex-cli',
    status: 'IMPLEMENTED',
    summary: 'implemented',
    changedFiles: ['src/a.ts'],
    created: '2026-06-27T00:00:00.000Z',
  } as LoopImplementationRecord;
  const testRecord = {
    id: 'test-1',
    issueId: issue.id,
    shardId: shard.id,
    round: 1,
    status: 'TEST-PASS',
    commands: [],
    coverage: {},
    created: '2026-06-27T00:00:00.000Z',
  } as LoopTestRecord;

  return {
    issue,
    state,
    spec: { status: 'APPROVED' } as LoopSpec,
    shards: [shard],
    annotations: [annotation],
    implementationRecords: [implementationRecord],
    testRecords: [testRecord],
    reviewRecords: [],
    ...overrides,
  } as LoopDetail;
}

function buildAdapter(detail: LoopDetail = buildDetail()) {
  const detailAdapter = {
    readDetail: jest.fn().mockResolvedValue(detail),
  };
  const store = {
    writeImplementationRecord: jest.fn().mockResolvedValue(undefined),
    writeReviewRecord: jest.fn().mockResolvedValue(undefined),
    appendLog: jest.fn().mockResolvedValue(undefined),
    writeNotification: jest.fn().mockResolvedValue(undefined),
  };
  const engine = {
    applyCostGuard: jest
      .fn()
      .mockImplementation((state: LoopStateItem) =>
        Promise.resolve({ ...state, costCalls: (state.costCalls ?? 0) + 1 }),
      ),
  };
  const gitAdapter = {
    commitShard: jest.fn().mockResolvedValue({
      shardId: 'shard-1',
      committed: true,
      message: 'commit shard-1',
      branch: 'main',
    }),
  };
  const adapter = new LoopsRemoteShardStateAdapter(
    detailAdapter as never,
    store as never,
    engine as never,
    gitAdapter as never,
  );
  return { adapter, detailAdapter, store, engine, gitAdapter };
}

describe('LoopsRemoteShardStateAdapter', () => {
  it('persists implementation records with annotation/shard/state updates', async () => {
    const { adapter, store, engine } = buildAdapter();
    const record = {
      id: 'impl-2',
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      implementer: 'remote-runner:codex-cli',
      status: 'IMPLEMENTED',
      summary: 'new implementation',
      changedFiles: ['src/new.ts'],
      tokens: 10,
      created: '2026-06-27T00:00:00.000Z',
    } as LoopImplementationRecord;

    await adapter.persistImplementation('issue-1', 'shard-1', record);

    expect(engine.applyCostGuard).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'PHASE_5_REVIEW', shardsInProgress: 0 }),
      { calls: 1, tokens: 10 },
    );
    expect(store.writeImplementationRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: 'issue-1',
        shardId: 'shard-1',
        record,
        annotations: [
          expect.objectContaining({
            implStatus: 'done',
            verdict: 'unreviewed',
            coverage: 'partial',
            location: ['src/new.ts'],
          }),
        ],
        shards: [expect.objectContaining({ id: 'shard-1', status: 'IMPLEMENTED' })],
      }),
    );
  });

  it('applies PASS review, commits the shard, and converges when all shards are done', async () => {
    const { adapter, store, gitAdapter } = buildAdapter();

    const record = await adapter.applyReview('issue-1', 'shard-1', {
      reviewer: 'codex',
      verdict: 'PASS',
      summary: 'looks good',
      issues: [],
      fixInstructions: [],
    });

    expect(record).toEqual(expect.objectContaining({ verdict: 'PASS', reviewer: 'codex' }));
    expect(store.writeReviewRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({ phase: 'PHASE_6_CONVERGE', shardsDone: 1 }),
        annotations: [
          expect.objectContaining({
            implStatus: 'done',
            testStatus: 'pass',
            verdict: 'pass',
            coverage: 'full',
          }),
        ],
        shards: [expect.objectContaining({ status: 'DONE' })],
      }),
    );
    expect(gitAdapter.commitShard).toHaveBeenCalledWith(
      expect.objectContaining({ changedFiles: ['src/a.ts'] }),
    );
    expect(store.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHARD_COMMIT', committed: true }),
    );
  });

  it('escalates NEEDS-WORK to FAIL at max redo and emits redo-limit side effects', async () => {
    const detail = buildDetail({
      reviewRecords: [
        { shardId: 'shard-1', verdict: 'NEEDS-WORK' },
        { shardId: 'shard-1', verdict: 'NEEDS-WORK' },
      ] as LoopReviewRecord[],
    });
    const { adapter, store, gitAdapter } = buildAdapter(detail);

    const record = await adapter.applyReview('issue-1', 'shard-1', {
      reviewer: 'codex',
      verdict: 'NEEDS-WORK',
      summary: 'needs work',
      issues: [],
      fixInstructions: ['fix it'],
    });

    expect(record.verdict).toBe('FAIL');
    expect(store.writeReviewRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        shards: [expect.objectContaining({ status: 'FAILED' })],
      }),
    );
    expect(store.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SHARD_REDO_LIMIT', status: 'FAILED' }),
    );
    expect(store.writeNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'SHARD_REDO_LIMIT' }),
    );
    expect(gitAdapter.commitShard).not.toHaveBeenCalled();
  });
});
