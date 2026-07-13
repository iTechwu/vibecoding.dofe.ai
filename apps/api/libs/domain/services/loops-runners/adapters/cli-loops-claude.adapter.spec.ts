import { ServiceUnavailableException } from '@nestjs/common';
import type { LoopIssue, LoopShard } from '@repo/contracts';
import { CliLoopsClaudeAdapter } from './cli-loops-claude.adapter';

jest.mock('@app/services/loops-runners');
jest.mock('@app/services/loops-store');

const { planAgentInvocation, runProcess } = require('@app/services/loops-runners') as {
  planAgentInvocation: jest.Mock;
  runProcess: jest.Mock;
};
const { resolveAllowedTargetRepo } = require('@app/services/loops-store') as {
  resolveAllowedTargetRepo: jest.Mock;
};

const issue: LoopIssue = {
  id: 'issue-20260713-00000000',
  title: 'Validate CLI failure handling',
  status: 'OPEN',
  priority: 'P1',
  created: '2026-07-13T00:00:00.000Z',
  updated: '2026-07-13T00:00:00.000Z',
  sourceChannel: 'WEB',
  sourceKind: 'WEB_FORM',
  submitterId: 'tester',
  submitterName: 'Test User',
  targetRepo: 'vibecoding.dofe.ai',
  body: 'Do not create deterministic evidence after a CLI failure.',
  acceptanceCriteria: ['Surface the CLI failure to the operator.'],
  rawPayloadRef: '.loops/intakes/issue-20260713-00000000.json',
};

const shard: LoopShard = {
  id: 'shard-1',
  specId: 'spec-1',
  title: 'Fail closed',
  status: 'READY',
  priority: 'P1',
  dependsOn: [],
  estContext: 1000,
  estEffort: 'S',
  acceptance: ['Return a recoverable error when CLI execution fails.'],
  testRequirements: { unit: [], integration: [], e2e: [] },
  filesHint: [],
};

describe('CliLoopsClaudeAdapter', () => {
  beforeEach(() => {
    planAgentInvocation.mockReturnValue({ command: 'claude', args: [], cwd: '/workspace' });
    resolveAllowedTargetRepo.mockResolvedValue('/workspace');
    runProcess.mockResolvedValue({ exitCode: 1, stdout: '', durationMs: 1 });
  });

  it('fails closed when Claude Code exits unsuccessfully after retries', async () => {
    const adapter = new CliLoopsClaudeAdapter({ warn: jest.fn() } as never);
    jest.spyOn(adapter as never, 'maxRetry').mockResolvedValue(0);
    jest.spyOn(adapter as never, 'shardTimeoutMs').mockResolvedValue(1_000);

    await expect(adapter.run({ issue, shard, round: 1, cwd: '/workspace' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
