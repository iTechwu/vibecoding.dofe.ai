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
      canary: { strategy: 'env-token', status: 'not-run', leakedInCommands: [] },
    });
  });

  it('fails and redacts output when a permitted command leaks the runtime canary', async () => {
    const runner = new LoopsRunnerService();

    const record = await runner.runShardTests({
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      cwd: process.cwd(),
      request: {
        runner: 'loops-runner',
        commands: ['node -e "process.stdout.write(process.env.LOOPS_RUNTIME_CANARY)"'],
      },
    });

    expect(record.status).toBe('TEST-FAIL');
    expect(record.commands[0]).toMatchObject({
      command: 'node -e "process.stdout.write(process.env.LOOPS_RUNTIME_CANARY)"',
      exitCode: 0,
      stdout: '[LOOPS_RUNTIME_CANARY_REDACTED]',
      stderr: '',
    });
    expect(record.failedTests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'runtime-security:canary',
          reason: expect.stringContaining('Runtime canary was leaked'),
        }),
      ]),
    );
    expect(record.runtimeSecurityPolicy?.canary).toEqual({
      strategy: 'env-token',
      status: 'leaked',
      leakedInCommands: ['node -e "process.stdout.write(process.env.LOOPS_RUNTIME_CANARY)"'],
    });
  });

  it('blocks network commands before shell execution', async () => {
    const runner = new LoopsRunnerService();

    const record = await runner.runShardTests({
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      cwd: process.cwd(),
      request: {
        runner: 'loops-runner',
        commands: ['node -e "require("child_process").execSync("curl https://example.com")"'],
      },
    });

    expect(record.status).toBe('TEST-FAIL');
    expect(record.commands[0]).toMatchObject({
      exitCode: 126,
      stderr: expect.stringContaining('network access via curl requires an approved override'),
    });
    expect(record.runtimeSecurityPolicy?.network).toMatchObject({
      status: 'blocked',
      blockedTools: ['curl'],
    });
  });

  it('blocks obvious writes outside the target repo scope', async () => {
    const runner = new LoopsRunnerService();

    const record = await runner.runShardTests({
      issueId: 'issue-1',
      shardId: 'shard-1',
      round: 1,
      cwd: process.cwd(),
      request: {
        runner: 'loops-runner',
        commands: ['node -e "require("fs").writeFileSync("/tmp/outside", "x")"'],
      },
    });

    expect(record.status).toBe('TEST-FAIL');
    expect(record.commands[0]).toMatchObject({
      exitCode: 126,
      stderr: expect.stringContaining('write pattern node-fs-outside-workspace escapes'),
    });
    expect(record.runtimeSecurityPolicy?.write).toMatchObject({
      blockedPatterns: ['node-fs-outside-workspace'],
    });
  });
});
