import {
  createRemoteShardRuntimeAdapter,
  createRemoteShardExecutionPort,
  LoopsRemoteShardRuntimeAdapter,
} from './loops-remote-shard-runtime.adapter';

describe('remote shard runtime provider wiring', () => {
  function buildAdapter() {
    const detailAdapter = {
      readDetail: jest.fn().mockResolvedValue({ issue: { id: 'issue-1' } }),
    };
    const logAdapter = {
      log: jest.fn(),
    };
    const stateAdapter = {
      persistImplementation: jest.fn().mockResolvedValue(undefined),
      applyReview: jest.fn().mockResolvedValue({ id: 'review-1' }),
    };
    const runner = {
      runShardTests: jest.fn().mockResolvedValue({ id: 'test-1', status: 'TEST-PASS' }),
    };
    const claudeAdapter = {
      run: jest.fn().mockResolvedValue({
        record: {
          id: 'impl-1',
          issueId: 'issue-1',
          shardId: 'shard-1',
          round: 1,
          implementer: 'claude',
          status: 'IMPLEMENTED',
          summary: 'implemented',
          changedFiles: [],
          created: '2026-06-27T00:00:00.000Z',
        },
      }),
    };
    const agentAdapter = {
      review: jest.fn().mockResolvedValue({
        verdict: 'PASS',
        summary: 'ok',
        issues: [],
        fixInstructions: [],
      }),
    };
    const dockerSandbox = {
      executeOrThrow: jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'docker ok' }),
    };
    const adapter = createRemoteShardRuntimeAdapter({
      detailAdapter: detailAdapter as never,
      logAdapter: logAdapter as never,
      runner: runner as never,
      claudeAdapter: claudeAdapter as never,
      agentAdapter: agentAdapter as never,
      stateAdapter: stateAdapter as never,
      dockerSandbox: dockerSandbox as never,
    });
    return {
      adapter,
      detailAdapter,
      logAdapter,
      runner,
      claudeAdapter,
      agentAdapter,
      stateAdapter,
      dockerSandbox,
    };
  }

  it('delegates the execution-port provider to LoopsRemoteRunnersService with adapter ports', () => {
    const executionPort = { executeRemoteShardJob: jest.fn() };
    const remoteRunners = {
      createShardExecutionPort: jest.fn().mockReturnValue(executionPort),
    };
    const runtimePort = { readDetail: jest.fn() };
    const logSink = { log: jest.fn() };
    const runtimeAdapter = { runtimePort, logSink };

    const result = createRemoteShardExecutionPort(remoteRunners as never, runtimeAdapter as never);

    expect(result).toBe(executionPort);
    expect(remoteRunners.createShardExecutionPort).toHaveBeenCalledWith(runtimePort, logSink);
  });

  it('bridges read/log to dedicated adapters and persist/apply to the state adapter', async () => {
    const { adapter, detailAdapter, logAdapter, stateAdapter } = buildAdapter();
    const runtimePort = adapter.runtimePort;

    await runtimePort.readDetail('issue-1');
    await runtimePort.persistImplementation('issue-1', 'shard-1', { id: 'impl-1' } as never);
    await runtimePort.applyReview('issue-1', 'shard-1', { verdict: 'PASS' } as never);
    adapter.logSink.log('info', 'hello', { issueId: 'issue-1' });

    expect(detailAdapter.readDetail).toHaveBeenCalledWith('issue-1');
    expect(stateAdapter.persistImplementation).toHaveBeenCalledWith('issue-1', 'shard-1', {
      id: 'impl-1',
    });
    expect(stateAdapter.applyReview).toHaveBeenCalledWith('issue-1', 'shard-1', {
      verdict: 'PASS',
    });
    expect(logAdapter.log).toHaveBeenCalledWith('info', 'hello', { issueId: 'issue-1' });
  });

  it('runs non-docker implementation through the Claude adapter', async () => {
    const { adapter, claudeAdapter } = buildAdapter();

    const result = await adapter.runtimePort.runImplementation({
      issue: { id: 'issue-1', targetRepo: '/repo' } as never,
      shard: { id: 'shard-1' } as never,
      round: 1,
      runtimeBackend: 'codex-cli',
    });

    expect(claudeAdapter.run).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/repo', round: 1 }),
    );
    expect(result.record.implementer).toBe('remote-runner:codex-cli');
  });

  it('runs docker implementation through the Docker sandbox when available', async () => {
    const { adapter, dockerSandbox, claudeAdapter } = buildAdapter();

    const result = await adapter.runtimePort.runImplementation({
      issue: { id: 'issue-1', targetRepo: '/repo' } as never,
      shard: { id: 'shard-1' } as never,
      round: 1,
      runtimeBackend: 'docker',
      sandboxProfile: 'strict',
    });

    expect(dockerSandbox.executeOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'strict',
        networkMode: 'none',
        workdir: '/repo',
      }),
    );
    expect(claudeAdapter.run).not.toHaveBeenCalled();
    expect(result.record.implementer).toBe('remote-runner:docker');
    expect(result.logContent).toBe('docker ok');
  });

  it('runs tests through LoopsRunnerService and reviews through the agent adapter', async () => {
    const { adapter, runner, agentAdapter } = buildAdapter();

    await adapter.runtimePort.runTests({
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      cwd: '/repo',
      runtimeBackend: 'docker',
      command: 'pnpm test',
      sandboxProfile: 'strict',
    });
    await adapter.runtimePort.review({
      shard: { id: 'shard-1' } as never,
      implementationRecord: { id: 'impl-1' } as never,
    });

    expect(runner.runShardTests).toHaveBeenCalledWith(
      expect.objectContaining({
        request: { commands: ['pnpm test'], runner: 'remote-runner:docker' },
        sandboxProfile: expect.objectContaining({ network: 'deny' }),
      }),
    );
    expect(agentAdapter.review).toHaveBeenCalledWith({
      shard: { id: 'shard-1' },
      implementationRecord: { id: 'impl-1' },
    });
  });
});
