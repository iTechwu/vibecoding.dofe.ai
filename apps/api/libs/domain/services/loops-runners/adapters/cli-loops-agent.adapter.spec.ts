import { ServiceUnavailableException } from '@nestjs/common';
import type { LoopIssue } from '@repo/contracts';
import { CliLoopsAgentAdapter } from './cli-loops-agent.adapter';

describe('CliLoopsAgentAdapter', () => {
  it('fails closed when Codex cannot produce a valid plan after retries', async () => {
    const adapter = new CliLoopsAgentAdapter({ warn: jest.fn() } as never);
    jest.spyOn(adapter as never, 'maxRetry').mockResolvedValue(0);
    jest.spyOn(adapter as never, 'callCodex').mockResolvedValue(undefined);

    await expect(
      adapter.plan(
        {
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
        } as LoopIssue,
        '2026-07-13T00:00:00.000Z',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns a validated Codex plan when the CLI produces valid output', async () => {
    const adapter = new CliLoopsAgentAdapter({ warn: jest.fn() } as never);
    jest.spyOn(adapter as never, 'maxRetry').mockResolvedValue(0);
    jest.spyOn(adapter as never, 'callCodex').mockResolvedValue({
      body: 'A validated plan returned by Codex.',
      contextBudget: 12_000,
    });

    const plan = await adapter.plan(
      {
        id: 'issue-20260713-00000001',
        title: 'Validate CLI success handling',
        status: 'OPEN',
        priority: 'P1',
        created: '2026-07-13T00:00:00.000Z',
        updated: '2026-07-13T00:00:00.000Z',
        sourceChannel: 'WEB',
        sourceKind: 'WEB_FORM',
        submitterId: 'tester',
        submitterName: 'Test User',
        targetRepo: 'vibecoding.dofe.ai',
        body: 'Preserve validated Codex output.',
        acceptanceCriteria: ['Return the parsed Codex plan.'],
        rawPayloadRef: '.loops/intakes/issue-20260713-00000001.json',
      } as LoopIssue,
      '2026-07-13T00:00:00.000Z',
    );

    expect(plan).toMatchObject({
      id: 'spec-20260713-00000001',
      contextBudget: 12_000,
      body: 'A validated plan returned by Codex.',
    });
  });
});
