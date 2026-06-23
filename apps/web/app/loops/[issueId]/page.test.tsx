import { fireEvent, render, screen } from '@testing-library/react';
import type { LoopDetail } from '@repo/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import LoopIssueDetailPage from './page';

const runBrowserQa = vi.fn();
const runSecondOpinion = vi.fn();
const requireSecondOpinion = vi.fn();
const recordReleaseCanary = vi.fn();
const setBrowserQaSessionPolicy = vi.fn();
const recordRuntimeOverride = vi.fn();

const detail: LoopDetail = {
  issue: {
    id: 'issue-1',
    title: 'Ship trace timeline',
    status: 'IN_LOOP',
    priority: 'P1',
    created: '2026-06-20T00:00:00.000Z',
    updated: '2026-06-20T00:00:00.000Z',
    sourceChannel: 'web',
    sourceKind: 'web_form',
    submitterId: 'user-1',
    submitterName: 'Product',
    targetRepo: '/repo/app',
    body: 'Make Loops trace evidence scannable.',
    acceptanceCriteria: ['Trace timeline is visible'],
    rawPayloadRef: '.loops/intakes/intake-1.raw.json',
  },
  intake: {
    id: 'intake-1',
    issueId: 'issue-1',
    sourceChannel: 'web',
    sourceKind: 'web_form',
    submitter: { provider: 'dev', userId: 'user-1', name: 'Product' },
    rawPayloadRef: '.loops/intakes/intake-1.raw.json',
    status: 'NORMALIZED',
    created: '2026-06-20T00:00:00.000Z',
    ruleSnapshot: {
      workspaceId: 'default',
      root: '/repo/app',
      capturedAt: '2026-06-20T00:00:00.000Z',
      present: 1,
      total: 4,
      rules: [
        {
          id: 'agents',
          label: 'AGENTS.md',
          path: 'AGENTS.md',
          status: 'present',
          summary: '# Agent rules',
          updated: '2026-06-20T00:00:00.000Z',
        },
        {
          id: 'cline-rules',
          label: 'Cline rules',
          path: '.clinerules',
          status: 'missing',
        },
      ],
      diagnostics: [
        {
          id: 'rules-thin',
          level: 'info',
          message: 'Only one workspace rule source is present.',
          evidence: 'AGENTS.md',
        },
      ],
      enforcement: {
        policy: 'snapshot-required',
        status: 'enforced',
        agentReadable: true,
        evidence: ['AGENTS.md'],
      },
    },
  },
  shards: [
    {
      id: 'shard-1',
      specId: 'spec-1',
      title: 'Render timeline evidence',
      status: 'IN_PROGRESS',
      priority: 'P1',
      dependsOn: [],
      estContext: 1200,
      estEffort: 'M',
      acceptance: ['Trace timeline is visible'],
      testRequirements: {
        unit: ['Render timeline section'],
        integration: [],
        e2e: [],
      },
      filesHint: ['apps/web/app/loops/[issueId]/page.tsx'],
    },
  ],
  annotations: [],
  implementationRecords: [],
  reviewRecords: [],
  testRecords: [],
  logs: [
    {
      ts: '2026-06-20T00:10:00.000Z',
      type: 'REVIEW_RECORD',
      issue: 'issue-1',
      shard: 'shard-1',
      verdict: 'PASS',
      payload: { summary: 'Reviewed implementation', changedFiles: ['apps/web/page.tsx'] },
    },
    {
      ts: '2026-06-20T00:05:00.000Z',
      type: 'IMPLEMENTATION_RECORD',
      issue: 'issue-1',
      shard: 'shard-1',
      status: 'DONE',
      payload: { summary: 'Added timeline' },
    },
  ],
  notifications: [],
  state: {
    issueId: 'issue-1',
    phase: 'PHASE_4_IMPLEMENT',
    round: 1,
    specVersion: 'v1',
    shardsTotal: 1,
    shardsDone: 0,
    shardsInProgress: 1,
    reloopCount: 0,
    costTokens: 0,
    costCalls: 0,
    updated: '2026-06-20T00:10:00.000Z',
    paused: true,
    finalized: false,
  },
  requirementsCoverage: {
    summary: {
      total: 1,
      accepted: 0,
      reviewed: 1,
      tested: 0,
      implemented: 0,
      planned: 0,
      missing: 0,
      percent: 100,
    },
    items: [
      {
        id: 'REQ-1',
        criterion: 'Trace timeline is visible',
        inSpec: true,
        shardIds: ['shard-1'],
        testIds: [],
        implementationRecordIds: ['impl-1'],
        reviewRecordIds: ['review-1'],
        status: 'reviewed',
      },
    ],
  },
  evidenceArtifacts: [
    {
      id: 'issue-1-logs',
      label: 'Annotations',
      kind: 'annotations',
      path: '.loops/logs/loops.jsonl',
      status: 'present',
      count: 2,
      summary: '2 reviewer annotations captured for requirement coverage.',
    },
    {
      id: 'issue-1-tests',
      label: 'Test Records',
      kind: 'test-record',
      path: '.loops/tests/issue-1',
      status: 'pending',
      count: 0,
      summary: 'Shard tests have not been captured yet.',
    },
  ],
  learnings: [
    {
      id: 'issue-1-learning-decision',
      workspaceId: 'default',
      repo: '/repo/app',
      kind: 'decision',
      summary:
        'Loop finalized with global verdict PASS; convergence PR DRAFT captured 1 commit references.',
      evidenceIds: ['issue-1-spec', 'issue-1-convergence-pr'],
      confidence: 0.9,
      createdAt: '2026-06-23T00:00:00.000Z',
    },
  ],
  workflowRecipe: {
    id: 'default-feature',
    name: 'Default Codex / Claude Code delivery',
    version: 1,
    appliesTo: ['feature'],
    capturedAt: '2026-06-20T00:10:00.000Z',
    source: 'default',
    steps: [
      {
        id: 'issue-1-spec-review',
        kind: 'spec_review',
        label: 'Spec Review',
        required: true,
        status: 'passed',
        owner: 'codex',
        humanGate: 'approval',
        phase: 'PHASE_2_REVIEW',
        evidenceTypes: ['spec'],
        evidenceIds: ['issue-1-spec'],
      },
      {
        id: 'issue-1-implementation',
        kind: 'implementation',
        label: 'Implementation',
        required: true,
        status: 'current',
        owner: 'claude-code',
        humanGate: 'none',
        phase: 'PHASE_4_IMPLEMENT',
        evidenceTypes: ['implementation-record'],
        evidenceIds: [],
      },
      {
        id: 'issue-1-release-gate',
        kind: 'release_gate',
        label: 'Release Gate',
        required: true,
        status: 'pending',
        owner: 'codex',
        humanGate: 'decision',
        phase: 'PHASE_8_ANNOTATE',
        evidenceTypes: ['convergence-pr'],
        evidenceIds: [],
      },
    ],
  },
  reviewGates: [
    {
      id: 'issue-1-gate-product',
      kind: 'product',
      status: 'passed',
      reviewer: 'human',
      confidence: 0.9,
      findingsCount: 0,
      evidenceId: 'issue-1-spec',
      requiredByStepId: 'issue-1-spec-review',
      updated: '2026-06-20T00:10:00.000Z',
    },
    {
      id: 'issue-1-gate-code',
      kind: 'code',
      status: 'pending',
      reviewer: 'codex',
      findingsCount: 1,
      requiredByStepId: 'issue-1-code-review',
      updated: '2026-06-20T00:10:00.000Z',
    },
  ],
  releaseGate: {
    id: 'issue-1-release-gate',
    status: 'blocked',
    checklist: {
      specApproved: true,
      implementationEvidence: false,
      testsPassed: false,
      requiredReviewsPassed: false,
      secondOpinionPassed: true,
      browserQaPassed: false,
      docsUpdated: true,
      prReady: false,
      rollbackNote: false,
    },
    evidenceIds: ['issue-1-spec'],
    blocker: 'Loop is paused',
    updated: '2026-06-20T00:10:00.000Z',
  },
  secondOpinion: {
    id: 'issue-1-second-opinion',
    status: 'not_required',
    primary: {
      role: 'primary',
      reviewer: 'codex',
      status: 'passed',
      findingsCount: 1,
      findings: [
        {
          fingerprint: 'review-1-finding',
          severity: 'major',
          desc: 'Primary reviewer finding.',
          sourceEvidenceId: 'review-1',
        },
      ],
      evidenceIds: ['review-1'],
      summary: 'Codex primary review has 1 finding across shard review evidence.',
    },
    secondary: {
      role: 'secondary',
      reviewer: 'claude-code',
      status: 'pending',
      findingsCount: 0,
      findings: [],
      evidenceIds: [],
      summary: 'Claude Code secondary review is waiting for the second-opinion worker.',
    },
    comparison: {
      agreementCount: 0,
      primaryOnlyCount: 1,
      secondaryOnlyCount: 0,
      conflictCount: 0,
      agreementFingerprints: [],
      primaryOnlyFingerprints: ['review-1-finding'],
      secondaryOnlyFingerprints: [],
      conflictFingerprints: [],
    },
    requiredForRelease: false,
    updated: '2026-06-20T00:10:00.000Z',
  },
};

vi.mock('next/navigation', () => ({
  useParams: () => ({ issueId: 'issue-1' }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api/contracts/hooks', () => ({
  useLoopIssue: () => ({
    data: {
      body: {
        data: detail,
      },
    },
    isLoading: false,
  }),
  useLoopsAgentRuntime: () => ({
    data: {
      body: {
        data: {
          summary: { running: 1, attention: 0, idle: 1, total: 2 },
          agents: [
            {
              id: 'claude-code-runner',
              label: 'Claude Code',
              status: 'running',
              phase: 'PHASE_4_IMPLEMENT',
              supportedPhases: ['PHASE_4_IMPLEMENT'],
              issueId: 'issue-1',
              issueTitle: 'Ship trace timeline',
              href: '/loops/issue-1',
              meta: 'implementing shard',
              diagnostics: [],
              updated: '2026-06-20T00:10:00.000Z',
            },
          ],
          diagnostics: [],
          runtimes: [
            {
              agent: 'claude-code',
              preferredMode: 'local-cli',
              selected: {
                mode: 'local-cli',
                status: 'ready',
                command: 'claude',
                workspaceRequired: true,
              },
              checks: [],
            },
          ],
          workspaceId: 'default',
        },
      },
    },
  }),
}));

vi.mock('./use-loop-operations', () => ({
  useFormState: () => ({
    operations: {
      errorMessage: undefined,
      isPending: false,
    },
    approveSpec: vi.fn(),
    advanceLoop: vi.fn(),
    pauseLoop: vi.fn(),
    reloop: vi.fn(),
    requestRevision: vi.fn(),
    resumeLoop: vi.fn(),
    runBrowserQa,
    runSecondOpinion,
    requireSecondOpinion,
    recordReleaseCanary,
    setBrowserQaSessionPolicy,
    recordRuntimeOverride,
  }),
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('LoopIssueDetailPage', () => {
  it('renders a scannable trace timeline from issue logs', () => {
    renderWithIntl(<LoopIssueDetailPage />);

    expect(screen.getByText('Flow Status')).toBeInTheDocument();
    expect(screen.getByText('Current agent')).toBeInTheDocument();
    expect(screen.getAllByText('Claude Code').length).toBeGreaterThan(0);
    expect(screen.getByText('live runtime')).toBeInTheDocument();
    expect(screen.getByText('Trace Timeline')).toBeInTheDocument();
    expect(screen.getByText('Scope Summary')).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();
    expect(
      screen.getByText(/Review recorded · Passed · last 2026-06-20T00:10:00.000Z/),
    ).toBeInTheDocument();
    expect(screen.getByText('2/2 events')).toBeInTheDocument();
    expect(screen.getAllByText('Review recorded').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Implementation recorded').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Passed').length).toBeGreaterThan(0);
    expect(screen.getByText(/Summary: Reviewed implementation/)).toBeInTheDocument();
    expect(screen.getByText(/Changed Files: 1 items/)).toBeInTheDocument();
    expect(screen.getByText('Resume Checkpoints')).toBeInTheDocument();
    expect(screen.getByText('1 checkpoints')).toBeInTheDocument();
    expect(screen.getAllByText('Render timeline evidence').length).toBeGreaterThan(0);
    expect(screen.getByText(/Auto-resume/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Auto-resume · Review recorded · Passed · last event 2026-06-20T00:10:00.000Z',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Checkpoint Diff')).toBeInTheDocument();
    expect(screen.getByText('Spec revision')).toBeInTheDocument();
    expect(screen.getByText('intake to v1 · round 1')).toBeInTheDocument();
    expect(screen.getByText('Rule Snapshot')).toBeInTheDocument();
    expect(screen.getByText('1/4 rules · Agent readable')).toBeInTheDocument();
    expect(screen.getByText('AGENTS.md · present')).toBeInTheDocument();
    expect(
      screen.getByText('Only one workspace rule source is present. · AGENTS.md'),
    ).toBeInTheDocument();
    expect(screen.getByText('Evidence Artifact Workspace')).toBeInTheDocument();
    expect(screen.getAllByText('Review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test').length).toBeGreaterThan(0);
    expect(screen.getByText('Ready for audit')).toBeInTheDocument();
    expect(screen.getByText('View test evidence')).toBeInTheDocument();
    expect(
      screen.getByText('2 reviewer annotations captured for requirement coverage.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Delivery Controls')).toBeInTheDocument();
    expect(screen.getByText('Delivery Actions')).toBeInTheDocument();
    expect(screen.getByText('Default Codex / Claude Code delivery')).toBeInTheDocument();
    expect(screen.getByText('Workflow Timeline')).toBeInTheDocument();
    expect(screen.getByText('Review Gates')).toBeInTheDocument();
    expect(screen.getAllByText('Release Gate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Implementation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Product').length).toBeGreaterThan(0);
    expect(screen.getByText('Loop is paused')).toBeInTheDocument();
    expect(screen.getAllByText('Browser QA').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Run Browser QA' })).toBeInTheDocument();
    expect(screen.getAllByText('Second Opinion').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Run second opinion' })).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Secondary')).toBeInTheDocument();
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Claude Code').length).toBeGreaterThan(0);
    expect(screen.getByText('Primary only')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByText('Learning Memory')).toBeInTheDocument();
    expect(screen.getByText('1 reusable learnings from this loop')).toBeInTheDocument();
    expect(screen.getByText('Decision')).toBeInTheDocument();
    expect(screen.getByText('90% confidence')).toBeInTheDocument();
    expect(screen.getByText('2 evidence links')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Loop finalized with global verdict PASS; convergence PR DRAFT captured 1 commit references.',
      ),
    ).toBeInTheDocument();
  });

  it('submits Browser QA and second-opinion delivery actions', () => {
    runBrowserQa.mockClear();
    runSecondOpinion.mockClear();
    renderWithIntl(<LoopIssueDetailPage />);

    fireEvent.change(screen.getByLabelText('Target URL'), {
      target: { value: 'https://example.com/qa' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Run Browser QA' }).closest('form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Run second opinion' }));

    expect(runBrowserQa).toHaveBeenCalledTimes(1);
    expect(runSecondOpinion).toHaveBeenCalledTimes(1);
  });

  it('renders timeline entries with duplicate event identities without React key collisions', () => {
    const originalLogs = detail.logs;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    detail.logs = [
      {
        ts: '2026-06-22T09:48:50.168Z',
        type: 'SPEC_STATE',
        issue: 'issue-20260622-85807ff4',
        status: 'DRAFT',
        payload: { status: 'DRAFT' },
      },
      {
        ts: '2026-06-22T09:48:50.168Z',
        type: 'SPEC_STATE',
        issue: 'issue-20260622-85807ff4',
        status: 'APPROVED',
        payload: { status: 'APPROVED' },
      },
    ];

    try {
      renderWithIntl(<LoopIssueDetailPage />);

      const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
        call.some((arg) => String(arg).includes('same key')),
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
      expect(screen.getByText('2/2 events')).toBeInTheDocument();
      expect(screen.getAllByText('Spec State').length).toBeGreaterThanOrEqual(2);
    } finally {
      detail.logs = originalLogs;
      consoleError.mockRestore();
    }
  });

  it('keeps internal phase controls out of the default issue detail UI', () => {
    const originalSpec = detail.spec;
    detail.spec = {
      id: 'spec-1',
      issueId: 'issue-1',
      version: 'v1',
      status: 'APPROVED',
      created: '2026-06-20T00:00:00.000Z',
      contextBudget: 24000,
      body: 'Approved spec body',
      approvedBy: 'tester',
    };

    try {
      renderWithIntl(<LoopIssueDetailPage />);

      expect(screen.getByRole('button', { name: 'Continue Loop' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Decompose' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Run Step' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Global Review' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument();
    } finally {
      detail.spec = originalSpec;
    }
  });

  it('keeps resume as a secondary safety control when the loop is paused', () => {
    renderWithIntl(<LoopIssueDetailPage />);

    const continueButton = screen.getByRole('button', { name: 'Continue Loop' });
    const resumeButton = screen.getByRole('button', { name: 'Resume' });

    expect(continueButton).toHaveClass('bg-foreground');
    expect(resumeButton).not.toHaveClass('bg-foreground');
  });

  it('surfaces issue-level exceptions with owner, action, and evidence', () => {
    renderWithIntl(<LoopIssueDetailPage />);

    expect(screen.getByText('Issue Exception')).toBeInTheDocument();
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(1);
    expect(screen.getByText('Loop operator')).toBeInTheDocument();
    expect(screen.getByText('Resume loop or assign recovery')).toBeInTheDocument();
    expect(screen.getByText('Implement · round 1')).toBeInTheDocument();
    expect(screen.getByText('Runtime: Claude Code is Running')).toBeInTheDocument();
  });

  it('defaults evidence records to the current round and summarizes hidden history', () => {
    const originalRound = detail.state.round;
    const originalImplementationRecords = detail.implementationRecords;
    const originalReviewRecords = detail.reviewRecords;
    const originalTestRecords = detail.testRecords;
    const originalEvidenceArtifacts = detail.evidenceArtifacts;

    detail.state.round = 2;
    detail.implementationRecords = [
      {
        id: 'impl-current',
        issueId: 'issue-1',
        shardId: 'shard-1',
        round: 2,
        implementer: 'claude-code',
        status: 'IMPLEMENTED',
        summary: 'Current round implementation',
        changedFiles: ['apps/web/current.tsx'],
        created: '2026-06-20T00:20:00.000Z',
      },
      {
        id: 'impl-old',
        issueId: 'issue-1',
        shardId: 'shard-1',
        round: 1,
        implementer: 'claude-code',
        status: 'NEEDS-WORK',
        summary: 'Old round implementation',
        changedFiles: ['apps/web/old.tsx'],
        created: '2026-06-20T00:10:00.000Z',
      },
    ];
    detail.reviewRecords = [
      {
        id: 'review-old',
        issueId: 'issue-1',
        shardId: 'shard-1',
        round: 1,
        reviewer: 'codex',
        verdict: 'NEEDS-WORK',
        issues: [{ severity: 'major', desc: 'Old issue' }],
        fixInstructions: ['Fix old issue'],
        summary: 'Old review',
        created: '2026-06-20T00:11:00.000Z',
      },
    ];
    detail.testRecords = [
      {
        id: 'test-current',
        issueId: 'issue-1',
        shardId: 'shard-1',
        round: 2,
        runner: 'system',
        reviewer: 'system',
        status: 'TEST-PASS',
        commands: [],
        failedTests: [],
        fixInstructions: [],
        created: '2026-06-20T00:21:00.000Z',
      },
    ];
    detail.evidenceArtifacts = [
      {
        id: 'artifact-base',
        label: 'Issue Record',
        kind: 'issue',
        path: '.loops/issues/issue-1.json',
        status: 'present',
        summary: 'Base issue evidence stays visible.',
      },
      {
        id: 'artifact-current',
        label: 'Current Round Test Artifact',
        kind: 'test-record',
        path: '.loops/tests/issue-1/records/test-current.json',
        status: 'present',
        round: 2,
        summary: 'Current round artifact',
      },
      {
        id: 'artifact-old',
        label: 'Old Round Implementation Artifact',
        kind: 'implementation-record',
        path: '.loops/runs/issue-1/shard-1/1/implementation.json',
        status: 'present',
        round: 1,
        summary: 'Old round artifact',
      },
    ];

    try {
      renderWithIntl(<LoopIssueDetailPage />);

      expect(screen.getByText('Current round implementation')).toBeInTheDocument();
      expect(screen.queryByText('Old round implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('Old review')).not.toBeInTheDocument();
      expect(screen.getByText('Current Round Test Artifact')).toBeInTheDocument();
      expect(screen.queryByText('Old Round Implementation Artifact')).not.toBeInTheDocument();
      expect(
        screen.getByText('Showing round 2 evidence. 2 historical records hidden.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Showing round 2 artifacts. 1 historical artifacts hidden.'),
      ).toBeInTheDocument();
    } finally {
      detail.state.round = originalRound;
      detail.implementationRecords = originalImplementationRecords;
      detail.reviewRecords = originalReviewRecords;
      detail.testRecords = originalTestRecords;
      detail.evidenceArtifacts = originalEvidenceArtifacts;
    }
  });

  it('explains that Continue Loop generates the draft when no spec exists yet', () => {
    const originalSpec = detail.spec;
    detail.spec = undefined;
    try {
      renderWithIntl(<LoopIssueDetailPage />);
      expect(
        screen.getByText('No spec yet. Use Continue Loop to generate the draft for review.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue Loop' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generate Spec' })).not.toBeInTheDocument();
    } finally {
      detail.spec = originalSpec;
    }
  });

  it('shows approve + request-revision controls for a DRAFT spec', () => {
    const originalSpec = detail.spec;
    detail.spec = {
      id: 'spec-1',
      issueId: 'issue-1',
      version: 'v1',
      status: 'DRAFT',
      created: '2026-06-20T00:00:00.000Z',
      contextBudget: 24000,
      body: 'Draft spec body',
    };
    try {
      renderWithIntl(<LoopIssueDetailPage />);
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Request Revision' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Regenerate Spec' })).not.toBeInTheDocument();
    } finally {
      detail.spec = originalSpec;
    }
  });

  it('shows a lightweight spec diff when previous spec snapshots exist', () => {
    const originalSpec = detail.spec;
    const originalSpecHistory = detail.specHistory;
    detail.spec = {
      id: 'spec-2',
      issueId: 'issue-1',
      version: 'v2',
      status: 'DRAFT',
      created: '2026-06-20T00:10:00.000Z',
      contextBudget: 24000,
      body: ['# Spec', '- keep trace timeline', '- add current round evidence'].join('\n'),
    };
    detail.specHistory = [
      {
        id: 'spec-1',
        issueId: 'issue-1',
        version: 'v1',
        status: 'APPROVED',
        created: '2026-06-20T00:00:00.000Z',
        approvedBy: 'tester',
        body: ['# Spec', '- keep trace timeline', '- old artifact filter'].join('\n'),
      },
      {
        id: 'spec-2',
        issueId: 'issue-1',
        version: 'v2',
        status: 'DRAFT',
        created: '2026-06-20T00:10:00.000Z',
        body: ['# Spec', '- keep trace timeline', '- add current round evidence'].join('\n'),
      },
    ];

    try {
      renderWithIntl(<LoopIssueDetailPage />);

      expect(screen.getByText('Spec Diff')).toBeInTheDocument();
      expect(screen.getByText('v1 to v2')).toBeInTheDocument();
      expect(screen.getByText('1 added')).toBeInTheDocument();
      expect(screen.getByText('1 removed')).toBeInTheDocument();
      expect(screen.getByText('2 unchanged')).toBeInTheDocument();
      expect(screen.getByText('+ - add current round evidence')).toBeInTheDocument();
      expect(screen.getByText('- - old artifact filter')).toBeInTheDocument();
    } finally {
      detail.spec = originalSpec;
      detail.specHistory = originalSpecHistory;
    }
  });

  it('explains that Continue Loop regenerates a REVISION_REQUESTED spec', () => {
    const originalSpec = detail.spec;
    detail.spec = {
      id: 'spec-1',
      issueId: 'issue-1',
      version: 'v1',
      status: 'REVISION_REQUESTED',
      created: '2026-06-20T00:00:00.000Z',
      contextBudget: 24000,
      body: 'Spec awaiting revision',
    };
    try {
      renderWithIntl(<LoopIssueDetailPage />);
      expect(
        screen.getByText(
          'Revision requested. Use Continue Loop to produce the next draft for review.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue Loop' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Regenerate Spec' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    } finally {
      detail.spec = originalSpec;
    }
  });

  it('renders an APPROVED spec as read-only with no action buttons', () => {
    const originalSpec = detail.spec;
    detail.spec = {
      id: 'spec-1',
      issueId: 'issue-1',
      version: 'v1',
      status: 'APPROVED',
      created: '2026-06-20T00:00:00.000Z',
      contextBudget: 24000,
      body: 'Approved spec body',
      approvedBy: 'tester',
    };
    try {
      renderWithIntl(<LoopIssueDetailPage />);
      expect(
        screen.getByText(/Spec approved\. The engine is continuing automatically/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Request Revision' })).not.toBeInTheDocument();
    } finally {
      detail.spec = originalSpec;
    }
  });
});
