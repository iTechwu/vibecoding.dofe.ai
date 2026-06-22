import { render, screen } from '@testing-library/react';
import type { LoopDetail } from '@repo/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import LoopIssueDetailPage from './page';

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
    decompose: vi.fn(),
    finalizeLoop: vi.fn(),
    generateSpec: vi.fn(),
    globalReview: vi.fn(),
    pauseLoop: vi.fn(),
    reloop: vi.fn(),
    requestRevision: vi.fn(),
    resumeLoop: vi.fn(),
    runLoop: vi.fn(),
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
    expect(screen.getByText(/Resume or take over/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Resume or take over · Review recorded · Passed · last event 2026-06-20T00:10:00.000Z',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Checkpoint Diff')).toBeInTheDocument();
    expect(screen.getByText('Spec revision')).toBeInTheDocument();
    expect(screen.getByText('intake to v1 · round 1')).toBeInTheDocument();
    expect(screen.getByText('Evidence Artifact Workspace')).toBeInTheDocument();
    expect(screen.getAllByText('Review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test').length).toBeGreaterThan(0);
    expect(screen.getByText('Ready for audit')).toBeInTheDocument();
    expect(screen.getByText('Run shard or regression tests')).toBeInTheDocument();
    expect(
      screen.getByText('2 reviewer annotations captured for requirement coverage.'),
    ).toBeInTheDocument();
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
});
