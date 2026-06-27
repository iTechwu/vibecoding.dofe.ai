import { LoopsRemoteRunnersService } from './loops-remote-runners.service';
import type {
  LoopDetail,
  LoopImplementationRecord,
  LoopIssue,
  LoopShard,
  LoopStateItem,
  LoopTestRecord,
} from '@repo/contracts';

describe('LoopsRemoteRunnersService.uploadRemoteRunnerArtifacts', () => {
  function buildService(artifacts: Record<string, string | null>) {
    const store = {
      readRemoteRunnerArtifact: jest.fn(
        (_runnerId: string, _jobId: string, kind: string) => artifacts[kind] ?? null,
      ),
    };
    const service = new LoopsRemoteRunnersService(store as never);
    return { service, store };
  }

  it('returns a .loops-only message when no storage port is wired', async () => {
    const { service } = buildService({ manifest: '{}' });
    const result = await service.uploadRemoteRunnerArtifacts('rr-1', 'job-1', {});
    expect(result.uploaded).toBe(0);
    expect(result.message).toContain('.loops only');
  });

  it('uploads each present artifact kind and returns a signed url per kind', async () => {
    const { service } = buildService({
      manifest: '{"m":1}',
      'worker-log': 'log line',
      'worker-receipt': null,
      trace: '{"t":1}',
    });
    const storagePort = {
      upload: jest.fn().mockResolvedValue(undefined),
      privateDownloadUrl: jest
        .fn()
        .mockImplementation((_v: string, _b: string, key: string) =>
          Promise.resolve(`https://download/${key}`),
        ),
    };
    const logSink = { log: jest.fn() };

    const result = await service.uploadRemoteRunnerArtifacts(
      'rr-1',
      'job-1',
      { vendor: 'oss', bucket: 'dofe-public' },
      storagePort,
      logSink,
    );

    expect(result.uploaded).toBe(3);
    expect(result.artifacts.map((a) => a.kind).sort()).toEqual(
      ['manifest', 'trace', 'worker-log'].sort(),
    );
    expect(storagePort.upload).toHaveBeenCalledTimes(3);
    expect(logSink.log).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Uploaded 3'),
      expect.objectContaining({ uploaded: 3 }),
    );
  });

  it('skips individual artifact kinds that throw and keeps going', async () => {
    const { service } = buildService({ manifest: '{}', trace: '{}' });
    const storagePort = {
      upload: jest
        .fn()
        .mockImplementation((_v, _b, key: string) =>
          key.endsWith('manifest.json') ? Promise.reject(new Error('boom')) : Promise.resolve(),
        ),
      privateDownloadUrl: jest.fn().mockResolvedValue('https://download/trace'),
    };

    const result = await service.uploadRemoteRunnerArtifacts('rr-1', 'job-1', {}, storagePort);

    expect(result.uploaded).toBe(1);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['trace']);
  });
});

describe('LoopsRemoteRunnersService.executeRemoteShardJob', () => {
  function buildShard(overrides: Partial<LoopShard> = {}): LoopShard {
    return {
      id: 'shard-1',
      title: 'Shard 1',
      status: 'TODO',
      dependsOn: [],
      estContext: 100,
      filesHint: ['src/a.ts'],
      ...overrides,
    } as LoopShard;
  }

  function buildDetail(overrides: Partial<LoopDetail> = {}): LoopDetail {
    return {
      issue: {
        id: 'issue-1',
        title: 'Issue',
        status: 'OPEN',
        targetRepo: '/repo',
      } as LoopIssue,
      state: {
        issueId: 'issue-1',
        phase: 'PHASE_4_IMPLEMENT',
        round: 1,
        specVersion: 'v1',
        shardsTotal: 1,
        shardsDone: 0,
        shardsInProgress: 0,
        reloopCount: 0,
        costTokens: 0,
        costCalls: 0,
        paused: false,
        updated: '2026-06-27T00:00:00.000Z',
      } as LoopStateItem,
      shards: [buildShard()],
      annotations: [
        {
          target: 'shard-1',
          annotator: 'codex',
          implStatus: 'pending',
          testStatus: 'pending',
          verdict: 'unreviewed',
          coverage: 'none',
          risk: 'medium',
          location: [],
          notes: '',
        },
      ],
      implementationRecords: [],
      testRecords: [],
      reviewRecords: [],
    } as LoopDetail;
  }

  function buildRuntimePort(detail = buildDetail()) {
    const implementationRecord: LoopImplementationRecord = {
      id: 'impl-1',
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      implementer: 'remote-runner:codex-cli',
      status: 'IMPLEMENTED',
      summary: 'implemented',
      changedFiles: ['src/a.ts'],
      created: '2026-06-27T00:00:00.000Z',
    };
    const testRecord: LoopTestRecord = {
      id: 'test-1',
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      runner: 'remote-runner:codex-cli',
      status: 'TEST-PASS',
      commands: [{ command: 'pnpm test', exitCode: 0, stdout: 'ok', stderr: '', durationMs: 1 }],
      failedTests: [],
      created: '2026-06-27T00:00:00.000Z',
    };
    return {
      readDetail: jest.fn().mockResolvedValue(detail),
      runImplementation: jest.fn().mockResolvedValue({ record: implementationRecord }),
      persistImplementation: jest.fn().mockResolvedValue(undefined),
      runTests: jest.fn().mockResolvedValue(testRecord),
      review: jest.fn().mockResolvedValue({
        verdict: 'PASS',
        summary: 'review passed',
        issues: [],
        fixInstructions: [],
      }),
      applyReview: jest.fn().mockResolvedValue(undefined),
      implementationRecord,
      testRecord,
    };
  }

  function buildExecutionService(detail = buildDetail()) {
    const store = {
      writeShardProgress: jest.fn(),
      writeRemoteRunnerArtifact: jest.fn(),
      writeTestRecord: jest.fn(),
    };
    const service = new LoopsRemoteRunnersService(store as never);
    const runtimePort = buildRuntimePort(detail);
    return { service, store, runtimePort };
  }

  it('runs implementation through the runtime port, marks the shard in progress, and writes handoff artifact', async () => {
    const { service, store, runtimePort } = buildExecutionService();

    const result = await service.executeRemoteShardJob(
      {
        issueId: 'issue-1',
        shardId: 'shard-1',
        workerKind: 'implement',
        runtimeBackend: 'codex-cli',
        artifactRoot: '.loops/runs/rr/job-1',
      },
      runtimePort,
    );

    expect(result).toEqual(expect.objectContaining({ status: 'completed' }));
    expect(store.writeShardProgress).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'TODO', to: 'IN_PROGRESS', shardId: 'shard-1' }),
    );
    expect(runtimePort.runImplementation).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeBackend: 'codex-cli', round: 1 }),
    );
    expect(runtimePort.persistImplementation).toHaveBeenCalledWith(
      'issue-1',
      'shard-1',
      expect.objectContaining({ id: 'impl-1' }),
    );
    expect(result.artifacts).toEqual([
      expect.objectContaining({ kind: 'handoff', ref: '.loops/runs/rr/job-1/handoff.json' }),
    ]);
  });

  it('runs tests and persists test annotations and result artifact in domain', async () => {
    const { service, store, runtimePort } = buildExecutionService();

    const result = await service.executeRemoteShardJob(
      {
        issueId: 'issue-1',
        shardId: 'shard-1',
        workerKind: 'test',
        runtimeBackend: 'docker',
        artifactRoot: '.loops/runs/rr/job-2',
        command: 'pnpm test',
        sandboxProfile: 'strict',
      },
      runtimePort,
    );

    expect(result.status).toBe('completed');
    expect(runtimePort.runTests).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'pnpm test',
        runtimeBackend: 'docker',
        sandboxProfile: 'strict',
      }),
    );
    expect(store.writeTestRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ id: 'test-1', status: 'TEST-PASS' }),
        state: expect.objectContaining({ phase: 'PHASE_5_REVIEW' }),
      }),
    );
    expect(result.artifacts).toEqual([
      expect.objectContaining({
        kind: 'test-results',
        ref: '.loops/runs/rr/job-2/test-results.json',
      }),
    ]);
  });

  it('runs review and applies the verdict through the runtime port', async () => {
    const detail = buildDetail({
      implementationRecords: [buildRuntimePort().implementationRecord],
      testRecords: [buildRuntimePort().testRecord],
    });
    const { service, runtimePort } = buildExecutionService(detail);

    const result = await service.executeRemoteShardJob(
      {
        issueId: 'issue-1',
        shardId: 'shard-1',
        workerKind: 'review',
        runtimeBackend: 'claude-code-cli',
        artifactRoot: '.loops/runs/rr/job-3',
      },
      runtimePort,
    );

    expect(result.status).toBe('completed');
    expect(runtimePort.review).toHaveBeenCalledWith(
      expect.objectContaining({
        shard: expect.objectContaining({ id: 'shard-1' }),
        implementationRecord: expect.objectContaining({ id: 'impl-1' }),
      }),
    );
    expect(runtimePort.applyReview).toHaveBeenCalledWith(
      'issue-1',
      'shard-1',
      expect.objectContaining({ reviewer: 'remote-runner:claude-code-cli', verdict: 'PASS' }),
    );
    expect(result.artifacts).toEqual([
      expect.objectContaining({
        kind: 'review-verdict',
        ref: '.loops/runs/rr/job-3/review-verdict.json',
      }),
    ]);
  });
});
