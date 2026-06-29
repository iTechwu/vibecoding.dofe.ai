import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import NewLoopIssueForm from './new-loop-issue-form';

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

const mutateAsync = vi.fn();

vi.mock('@/providers', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock('@/lib/api/contracts/hooks', () => ({
  useCreateLoopIssue: () => ({
    mutateAsync,
    isPending: false,
    isError: false,
  }),
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('NewLoopIssueForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockReset();
    window.localStorage.clear();
  });

  it('prefills CrewAI-style templates for complete issue intake', async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewLoopIssueForm defaultTargetRepo="/repo/app" />);

    expect((screen.getByLabelText('Requirement Body') as HTMLTextAreaElement).value).toContain(
      'User goal:',
    );
    expect((screen.getByLabelText('Acceptance Criteria') as HTMLTextAreaElement).value).toContain(
      'Primary happy path is implemented end to end',
    );
    expect(screen.getByText('New product workflows or visible user value')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bugfix Loop' }));

    expect((screen.getByLabelText('Requirement Body') as HTMLTextAreaElement).value).toContain(
      'Reproduction steps:',
    );
    expect((screen.getByLabelText('Acceptance Criteria') as HTMLTextAreaElement).value).toContain(
      'A regression test covers the fixed behavior',
    );
    expect(screen.getByLabelText('Priority')).toHaveValue('P0');

    await user.click(screen.getByRole('button', { name: 'Flow Loop' }));

    expect(
      screen.getByText('CrewAI-style Flow, approval, or recovery workflows'),
    ).toBeInTheDocument();
    expect((screen.getByLabelText('Requirement Body') as HTMLTextAreaElement).value).toContain(
      'Human-in-the-loop gate:',
    );
    expect((screen.getByLabelText('Requirement Body') as HTMLTextAreaElement).value).toContain(
      'Resume point:',
    );
    expect((screen.getByLabelText('Acceptance Criteria') as HTMLTextAreaElement).value).toContain(
      'State transitions include success, failure, pause, and resume paths',
    );
    expect(screen.getByLabelText('Priority')).toHaveValue('P1');
  });

  it('keeps hover styling separate for selected and unselected templates', async () => {
    const user = userEvent.setup();
    renderWithIntl(<NewLoopIssueForm defaultTargetRepo="/repo/app" />);

    const featureTemplate = screen.getByRole('button', { name: 'Feature Loop' });
    const bugfixTemplate = screen.getByRole('button', { name: 'Bugfix Loop' });

    expect(featureTemplate).toHaveAttribute('aria-pressed', 'true');
    expect(featureTemplate).toHaveClass('hover:bg-foreground');
    expect(featureTemplate).not.toHaveClass('hover:bg-muted/40');
    expect(bugfixTemplate).toHaveAttribute('aria-pressed', 'false');
    expect(bugfixTemplate).toHaveClass('hover:bg-muted/40');
    expect(bugfixTemplate).not.toHaveClass('hover:bg-foreground');

    await user.click(bugfixTemplate);

    expect(featureTemplate).toHaveAttribute('aria-pressed', 'false');
    expect(featureTemplate).toHaveClass('hover:bg-muted/40');
    expect(bugfixTemplate).toHaveAttribute('aria-pressed', 'true');
    expect(bugfixTemplate).toHaveClass('hover:bg-foreground');
  });

  it('submits template criteria as individual acceptance items', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValueOnce({
      body: { data: { issue: { id: 'issue-template-1' } } },
    });
    renderWithIntl(<NewLoopIssueForm defaultTargetRepo="/repo/app" />);

    await user.type(screen.getByLabelText('Title'), 'Fix checkout regression');
    await user.click(screen.getByRole('button', { name: 'Create Issue' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      body: expect.objectContaining({
        title: 'Fix checkout regression',
        targetRepo: '/repo/app',
        priority: 'P1',
        acceptanceCriteria: expect.arrayContaining([
          'Primary happy path is implemented end to end',
          'Regression tests pass and implementation evidence is recorded',
        ]),
      }),
    });
    expect(push).toHaveBeenCalledWith('/loops/issue-template-1');
  });

  it('confirms current tenant before full issue submission and includes it in the payload', async () => {
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
    const user = userEvent.setup();
    mutateAsync.mockResolvedValueOnce({
      body: { data: { issue: { id: 'issue-template-tenant' } } },
    });
    renderWithIntl(<NewLoopIssueForm defaultTargetRepo="/repo/app" />);

    expect(await screen.findByText('Tenant')).toBeInTheDocument();
    expect(screen.getByText('优惠豚')).toBeInTheDocument();
    expect(screen.getByText(/tenant-youhuitun/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Fix checkout regression');
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

  it('blocks submit and shows a field error when the payload fails Zod validation (R10)', async () => {
    mutateAsync.mockClear();
    push.mockClear();
    const user = userEvent.setup();
    const { container } = renderWithIntl(<NewLoopIssueForm defaultTargetRepo="/repo/app" />);

    // Type a 2-char title: it passes the HTML `required` check (non-empty) but
    // fails the contract schema's min(4), so the client-side safeParse must
    // reject before any network call and render a field-level error span.
    await user.type(screen.getByLabelText('Title'), 'ab');
    await user.click(screen.getByRole('button', { name: 'Create Issue' }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.text-destructive').length).toBeGreaterThan(0);
  });
});
