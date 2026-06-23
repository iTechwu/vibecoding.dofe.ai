import { LoopsRunnerService } from './loops-runner.service';

describe('LoopsRunnerService runtime security policy', () => {
  it('blocks allowlisted command prefixes when shell control operators are present', async () => {
    const runner = new LoopsRunnerService();

    const record = await runner.runShardTests({
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      cwd: process.cwd(),
      request: {
        runner: 'loops-runner',
        commands: ['pnpm --version && echo should-not-run'],
      },
    });

    expect(record.status).toBe('TEST-FAIL');
    expect(record.commands).toEqual([
      {
        command: 'pnpm --version && echo should-not-run',
        exitCode: 126,
        durationMs: 0,
        stdout: '',
        stderr:
          'Command is blocked by runtime security policy: shell control operators are not allowed.',
      },
    ]);
    expect(record.failedTests[0]).toMatchObject({
      name: 'pnpm --version && echo should-not-run',
      reason:
        'Command is blocked by runtime security policy: shell control operators are not allowed.',
    });
    expect(record.runtimeSecurityPolicy).toMatchObject({
      mode: 'test-command',
      shell: expect.objectContaining({
        strategy: 'allowlist',
        blockedOperators: expect.arrayContaining(['&&', '$(', 'newline']),
      }),
      network: { strategy: 'deny-by-default', status: 'not-requested' },
      write: { strategy: 'workspace-scoped', scope: 'target-repo' },
      approvals: expect.objectContaining({
        override: 'not-supported',
        requiredFor: expect.arrayContaining(['shell-control-operator']),
      }),
    });
  });
});
