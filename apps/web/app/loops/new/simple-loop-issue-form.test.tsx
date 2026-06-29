import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import SimpleLoopIssueForm from './simple-loop-issue-form';

const replace = vi.fn();
const push = vi.fn();

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
  useRouter: () => ({ replace, push }),
}));

vi.mock('@/providers', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

const mutateAsync = vi.fn();

// Driven by a module-level binding so individual tests can flip the workspace
// availability (the other documented submit gate) without re-mocking.
let workspacesQuery: {
  data: {
    body: {
      data: {
        workspaces: Array<{ workspaceId: string; root: string }>;
        current: string;
        recentLearnings?: Array<{
          id: string;
          workspaceId: string;
          repo?: string;
          kind: 'pattern' | 'pitfall' | 'decision' | 'test_policy' | 'ownership' | 'security';
          summary: string;
          evidenceIds: string[];
          confidence: number;
          createdAt: string;
        }>;
      };
    };
  };
  isLoading: boolean;
};

vi.mock('@/lib/api/contracts/hooks', () => ({
  useCreateSimpleLoopIssue: () => ({
    mutateAsync,
    isPending: false,
    isError: false,
  }),
  useLoopsWorkspaces: () => workspacesQuery,
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SimpleLoopIssueForm (0622 · B5 simple-mode intake)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockReset();
    window.localStorage.clear();
    workspacesQuery = {
      data: {
        body: {
          data: {
            workspaces: [{ workspaceId: 'vibecoding', root: '/repo/vibecoding' }],
            current: 'vibecoding',
            recentLearnings: [
              {
                id: 'learning-test-policy',
                workspaceId: 'vibecoding',
                repo: '/repo/vibecoding',
                kind: 'test_policy',
                summary: 'Use unit + type-check before dashboard UI changes.',
                evidenceIds: ['test-record-1'],
                confidence: 0.88,
                createdAt: '2026-06-23T00:00:00.000Z',
              },
            ],
          },
        },
      },
      isLoading: false,
    };
  });

  it('renders only the simple-mode primary inputs (request, workspace, template)', () => {
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    // The one prominent field the user must fill.
    expect(screen.getByPlaceholderText(/Add a Docker fallback/i)).toBeInTheDocument();
    // Workspace + template selects are part of the compact simple-mode row.
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Template')).toBeInTheDocument();
    // The advanced "Title override" is collapsed (not the summary) and the
    // preview is empty before any input.
    expect(screen.getByText('Start typing to preview the generated issue.')).toBeInTheDocument();
    expect(screen.queryByText('Advanced settings')).toBeInTheDocument();
    // The submit CTA is present and gated until the request is long enough.
    expect(screen.getByRole('button', { name: 'Create Issue' })).toBeDisabled();
  });

  it('confirms current tenant before simple issue submission and includes it in the payload', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
      if (key === 'currentTenant') return 'tenant-youhuitun';
      if (key === 'currentTenantSnapshot') {
        return JSON.stringify({
          tenantId: 'tenant-youhuitun',
          tenantName: '优惠豚',
          teamId: 'team-1',
        });
      }
      return null;
    });
    mutateAsync.mockResolvedValueOnce({ body: { data: { issue: { id: 'issue-simple-tenant' } } } });
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    expect(await screen.findByText('Tenant')).toBeInTheDocument();
    expect(screen.getByText('优惠豚')).toBeInTheDocument();
    expect(screen.getByText(/tenant-youhuitun/)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/Add a Docker fallback/i),
      'Add a summary card to the loops dashboard',
    );
    await user.click(screen.getByRole('button', { name: 'Create Issue' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      body: expect.objectContaining({
        tenantContext: {
          tenantId: 'tenant-youhuitun',
          tenantName: '优惠豚',
          teamId: 'team-1',
        },
      }),
    });
  });

  it('keeps submit disabled until the request is at least 10 characters', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    const request = screen.getByPlaceholderText(/Add a Docker fallback/i);
    const submit = screen.getByRole('button', { name: 'Create Issue' });

    expect(screen.getByText('Add 10 more characters to create an issue.')).toBeInTheDocument();

    await user.type(request, 'short');
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(
        'At least 10 characters. Keep it to one sentence; expand details in the issue after creation.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Add 5 more characters to create an issue.')).toBeInTheDocument();

    await user.type(request, ' a slightly longer one');
    expect(submit).toBeEnabled();
    expect(
      screen.getByText(
        'Ready to create. The generated issue can be reviewed before the loop continues.',
      ),
    ).toBeInTheDocument();
  });

  it('blocks submit and surfaces guidance when no workspace is available', () => {
    workspacesQuery = {
      data: { body: { data: { workspaces: [], current: '' } } },
      isLoading: false,
    };
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    expect(screen.getByText('No workspace available')).toBeInTheDocument();
    expect(
      screen.getByText('Select or configure a workspace before submitting.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A workspace is required before this issue can be created.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Issue' })).toBeDisabled();
  });

  it('renders a live preview that shares the backend deterministic normalisation', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    // Before enough input, the preview is empty.
    expect(screen.getByText('Start typing to preview the generated issue.')).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/Add a Docker fallback/i),
      'Add a summary card to the loops dashboard',
    );

    // No bug/docker/fix keywords → feature template → "Add ..." title, P1, and the
    // shared feature acceptance criteria (same strings the backend persists).
    expect(screen.getAllByText('Add a summary card to the loops dashboard').length).toBeGreaterThan(
      0,
    );
    // P1 appears in the preview chip and in the collapsed advanced priority
    // options; both derive from the same shared normalisation.
    expect(screen.getAllByText('P1').length).toBeGreaterThan(0);
    expect(screen.getByText('Primary happy path is implemented end to end')).toBeInTheDocument();
    expect(screen.getByText('Recommended agent path')).toBeInTheDocument();
    expect(screen.getByText('Planner → Implementer → Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Suggested test policy')).toBeInTheDocument();
    expect(screen.getByText('unit + type-check + focused UI regression')).toBeInTheDocument();
    expect(screen.getByText('Relevant learnings')).toBeInTheDocument();
    expect(screen.getByText('Test Policy')).toBeInTheDocument();
    expect(
      screen.getByText(/Use unit \+ type-check before dashboard UI changes/),
    ).toBeInTheDocument();
  });

  it('binds bugfix templates to recovery mode and regression policy in preview', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    await user.type(
      screen.getByPlaceholderText(/Add a Docker fallback/i),
      'Fix checkout crash after payment callback',
    );

    expect(screen.getAllByText('P0').length).toBeGreaterThan(0);
    expect(screen.getByText('Recovery Agent → Implementer → Reviewer')).toBeInTheDocument();
    expect(screen.getByText('reproduction + regression test + type-check')).toBeInTheDocument();
  });

  it('submits the normalised payload and navigates to the new issue', async () => {
    mutateAsync.mockResolvedValueOnce({ body: { data: { issue: { id: 'issue-simple-1' } } } });
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    await user.type(
      screen.getByPlaceholderText(/Add a Docker fallback/i),
      'Add a summary card to the loops dashboard',
    );
    await user.click(screen.getByRole('button', { name: 'Create Issue' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      body: expect.objectContaining({
        request: 'Add a summary card to the loops dashboard',
        workspaceId: 'vibecoding',
        template: 'auto',
      }),
    });
    expect(push).toHaveBeenCalledWith('/loops/issue-simple-1');
  });

  it('uses the current workspace from the workspace query when submitting', async () => {
    workspacesQuery = {
      data: {
        body: {
          data: {
            workspaces: [
              { workspaceId: 'archive', root: '/repo/archive' },
              { workspaceId: 'vibecoding', root: '/repo/vibecoding' },
            ],
            current: 'vibecoding',
          },
        },
      },
      isLoading: false,
    };
    mutateAsync.mockResolvedValueOnce({ body: { data: { issue: { id: 'issue-simple-2' } } } });
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/default" />);

    await user.type(
      screen.getByPlaceholderText(/Add a Docker fallback/i),
      'Add a summary card to the loops dashboard',
    );

    expect(screen.getByText('/repo/vibecoding')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Issue' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      body: expect.objectContaining({
        workspaceId: 'vibecoding',
      }),
    });
  });

  it('lets advanced settings override the generated title in the preview', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SimpleLoopIssueForm defaultTargetRepo="/repo/vibecoding" />);

    await user.type(
      screen.getByPlaceholderText(/Add a Docker fallback/i),
      'Add a summary card to the loops dashboard',
    );

    await user.click(screen.getByText('Advanced settings'));
    const titleOverride = await screen.findByPlaceholderText(
      'Add a summary card to the loops dashboard',
    );
    await user.type(titleOverride, 'Custom retained title');

    // The preview title now reflects the override rather than the auto draft.
    expect(screen.getAllByText('Custom retained title').length).toBeGreaterThan(0);
  });
});
