import type { LoopAnnotation, LoopEvidenceArtifact, LoopIssue, LoopShard } from '@repo/contracts';
import { CliLoopsGitAdapter } from './cli-loops-git.adapter';

describe('CliLoopsGitAdapter', () => {
  it('includes present evidence artifacts in the convergence PR body', async () => {
    const adapter = new CliLoopsGitAdapter({ commitPerShard: false, baseBranch: 'main' });
    const issue: LoopIssue = {
      id: 'issue-1',
      title: 'Ship checkout fix',
      status: 'IN_LOOP',
      priority: 'P1',
      created: '2026-06-23T00:00:00.000Z',
      updated: '2026-06-23T00:00:00.000Z',
      sourceChannel: 'web',
      sourceKind: 'web_form',
      submitterId: 'u1',
      submitterName: 'Ada',
      targetRepo: process.cwd(),
      body: 'Fix checkout and prepare release.',
      acceptanceCriteria: ['checkout passes'],
      rawPayloadRef: '.loops/intakes/issue-1.raw.json',
    };
    const shards: LoopShard[] = [
      {
        id: 'shard-1',
        specId: 'spec-1',
        title: 'Checkout fix',
        status: 'DONE',
        priority: 'P1',
        dependsOn: [],
        estContext: 1200,
        estEffort: 'S',
        acceptance: ['checkout passes'],
        testRequirements: { unit: ['pnpm test'], integration: [], e2e: [] },
        filesHint: ['apps/web/app/checkout/page.tsx'],
      },
    ];
    const annotations: LoopAnnotation[] = [
      {
        target: 'shard-1',
        annotator: 'codex',
        round: 1,
        implStatus: 'done',
        testStatus: 'pass',
        verdict: 'pass',
        coverage: 'full',
        location: ['apps/web/app/checkout/page.tsx'],
        risk: 'low',
        notes: 'Ready.',
      },
    ];
    const evidenceArtifacts: LoopEvidenceArtifact[] = [
      {
        id: 'issue-1-spec',
        label: 'Spec',
        kind: 'spec',
        path: '.loops/specs/issue-1/spec.v1.json',
        status: 'present',
        summary: 'APPROVED spec v1 maps one acceptance criterion.',
      },
      {
        id: 'issue-1-test',
        label: 'Test shard-1',
        kind: 'test-record',
        path: '.loops/tests/issue-1/records/test-1.json',
        status: 'present',
        round: 1,
        count: 1,
        summary: 'TEST-PASS test run for shard-1; one command executed.',
      },
      {
        id: 'issue-1-convergence-pr',
        label: 'Convergence PR',
        kind: 'convergence-pr',
        path: '.loops/runs/issue-1/convergence-pr.json',
        status: 'pending',
        summary: 'Convergence PR evidence is pending until finalization.',
      },
    ];

    const convergencePr = await adapter.createConvergencePr({
      issue,
      shards,
      annotations,
      commits: [{ shardId: 'shard-1', committed: true, message: 'fix checkout' }],
      evidenceArtifacts,
    });

    expect(convergencePr.status).toBe('SKIPPED');
    expect(convergencePr.prBody).toContain('## Evidence 摘要');
    expect(convergencePr.prBody).toContain(
      '- Spec [spec]: APPROVED spec v1 maps one acceptance criterion. (.loops/specs/issue-1/spec.v1.json)',
    );
    expect(convergencePr.prBody).toContain(
      '- Test shard-1 [test-record] · round=1 · count=1: TEST-PASS test run for shard-1; one command executed. (.loops/tests/issue-1/records/test-1.json)',
    );
    expect(convergencePr.prBody).not.toContain('Convergence PR evidence is pending');
  });
});
