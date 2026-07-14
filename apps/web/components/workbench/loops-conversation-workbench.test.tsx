import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import { LoopsConversationWorkbench } from './loops-conversation-workbench';

const createIssue = vi.fn();
const refetch = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api/contracts/hooks', () => ({
  useLoopsList: () => ({
    data: {
      body: {
        data: {
          list: [
            {
              issue: {
                id: 'issue-1',
                title: 'Fix checkout flow',
                body: 'Improve the checkout error path.',
                status: 'IN_LOOP',
                priority: 'P1',
                updated: '2026-07-13T00:00:00.000Z',
              },
              state: { phase: 'PHASE_4_IMPLEMENT', paused: false },
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    },
    isLoading: false,
    isError: false,
    refetch,
  }),
  useCreateSimpleLoopIssue: () => ({ mutateAsync: createIssue, isPending: false, isError: false }),
}));

vi.mock('@/hooks/useLoopAdvanceSSE', () => ({
  useLoopAdvanceSSE: () => ({
    status: {
      jobId: 'advance-issue-1',
      issueId: 'issue-1',
      status: 'active',
      attempt: 1,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    isConnected: true,
  }),
}));

function renderWorkbench() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      <LoopsConversationWorkbench />
    </NextIntlClientProvider>,
  );
}

describe('LoopsConversationWorkbench', () => {
  beforeEach(() => {
    createIssue.mockReset();
    refetch.mockReset();
  });

  it('renders each existing issue as a request followed by an execution response', () => {
    renderWorkbench();

    expect(screen.getByText('Improve the checkout error path.')).toBeInTheDocument();
    expect(screen.getByText('Fix checkout flow')).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
  });

  it('shows the selected issue delivery context beside the conversation', () => {
    renderWorkbench();

    const context = screen.getByRole('complementary', { name: 'Delivery tracking' });
    expect(context).toBeInTheDocument();
    expect(within(context).getByText('Execution')).toBeInTheDocument();
    expect(within(context).getByText('No environment data')).toBeInTheDocument();
    expect(within(context).getAllByText('Running').length).toBeGreaterThan(0);
  });

  it('creates one simple issue from a sent request and keeps the conversation context', async () => {
    createIssue.mockResolvedValue({ body: { data: { issue: { id: 'issue-new' } } } });
    renderWorkbench();

    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work to run' }), {
      target: { value: 'Improve the checkout error path for mobile payments.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => {
      expect(createIssue).toHaveBeenCalledWith({
        body: { request: 'Improve the checkout error path for mobile payments.' },
      });
    });
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByText('Issue created')).toBeInTheDocument();
    expect(
      screen.getByText('Improve the checkout error path for mobile payments.'),
    ).toBeInTheDocument();
  });
});
