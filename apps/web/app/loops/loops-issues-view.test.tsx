import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { LoopIssueListItem } from '@repo/contracts';
import loopsMessages from '@/locales/en/loops.json';
import { LoopsIssuesView } from './loops-issues-view';
import { LoopsOperationsView } from './loops-operations-view';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const issues = [
  {
    issue: {
      id: 'active-issue',
      title: 'Active implementation',
      status: 'IN_LOOP',
      priority: 'P1',
      created: '2026-06-20T00:00:00.000Z',
      targetRepo: '/repo/app',
      updated: '2026-06-20T00:00:00.000Z',
      sourceChannel: 'web',
      sourceKind: 'web_form',
      submitterId: 'u1',
      submitterName: 'Ada',
    },
    state: { phase: 'PHASE_4_IMPLEMENT', paused: false },
  },
  {
    issue: {
      id: 'review-issue',
      title: 'Needs review',
      status: 'OPEN',
      priority: 'P0',
      created: '2026-06-19T00:00:00.000Z',
      targetRepo: '/repo/docs',
      updated: '2026-06-20T00:00:00.000Z',
      sourceChannel: 'web',
      sourceKind: 'web_form',
      submitterId: 'u2',
      submitterName: 'Grace',
    },
    state: { phase: 'PHASE_2_REVIEW', paused: true },
  },
] as LoopIssueListItem[];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('LoopsIssuesView', () => {
  it('puts actionable review issues before active issues without mutating the query list', () => {
    renderWithIntl(
      <LoopsIssuesView items={issues} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Issues' })).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      expect.stringContaining('Needs review'),
      expect.stringContaining('Active implementation'),
    ]);
    expect(issues.map((item) => item.issue.id)).toEqual(['active-issue', 'review-issue']);
  });

  it.each([
    ['loading', { isLoading: true, isError: false, items: issues }, 'Loading issues'],
    ['error', { isLoading: false, isError: true, items: issues }, 'Unable to load issues.'],
    [
      'empty',
      { isLoading: false, isError: false, items: [] as LoopIssueListItem[] },
      'No issues yet.',
    ],
  ] as const)('renders the %s state independently', (_state, flags, expected) => {
    renderWithIntl(<LoopsIssuesView {...flags} onRetry={vi.fn()} />);

    if (_state === 'loading') {
      expect(screen.getByLabelText(expected)).toHaveAttribute('aria-busy', 'true');
    } else {
      expect(screen.getByText(expected)).toBeInTheDocument();
    }
  });

  it('offers a retry control for list errors', () => {
    const onRetry = vi.fn();
    renderWithIntl(<LoopsIssuesView items={issues} isLoading={false} isError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a filtered empty result from an empty issue list', () => {
    renderWithIntl(
      <LoopsIssuesView isError={false} isFiltered isLoading={false} items={[]} onRetry={vi.fn()} />,
    );

    expect(screen.getByText('No matching issues.')).toBeInTheDocument();
  });
});

describe('LoopsOperationsView', () => {
  it('can expose management content immediately for the dedicated Operations route', () => {
    window.history.replaceState(null, '', '/loops?view=operations');
    renderWithIntl(
      <LoopsOperationsView defaultOpen>
        <section aria-label="Review Inbox">Review Inbox</section>
      </LoopsOperationsView>,
    );

    expect(screen.getByRole('region', { name: 'Review Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Operations' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('only exposes aria-controls while the controlled content is mounted', () => {
    window.history.replaceState(null, '', '/loops');
    renderWithIntl(
      <LoopsOperationsView>
        <section aria-label="Review Inbox">Review Inbox</section>
      </LoopsOperationsView>,
    );

    const trigger = screen.getByRole('button', { name: 'Operations' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');

    fireEvent.click(trigger);
    const contentId = trigger.getAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(contentId).toBe('operations-content');
    expect(document.getElementById(contentId!)).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
  });

  it('reveals management content from the Operations trigger', () => {
    window.history.replaceState(null, '', '/loops');
    renderWithIntl(
      <LoopsOperationsView>
        <section aria-label="Review Inbox">Review Inbox</section>
      </LoopsOperationsView>,
    );

    expect(screen.queryByRole('region', { name: 'Review Inbox' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }));
    expect(screen.getByRole('region', { name: 'Review Inbox' })).toBeInTheDocument();
  });

  it('opens and scrolls to the legacy loop board hash', async () => {
    window.history.replaceState(null, '', '#loop-board');
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderWithIntl(
      <LoopsOperationsView>
        <section id="loop-board" aria-label="Loop Board">
          Loop Board
        </section>
      </LoopsOperationsView>,
    );

    expect(await screen.findByRole('region', { name: 'Loop Board' })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('scrolls to each recognized hash while Operations stays open', async () => {
    window.history.replaceState(null, '', '#agent-runtime');
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderWithIntl(
      <LoopsOperationsView>
        <section id="agent-runtime" aria-label="Agent Runtime">
          Agent Runtime
        </section>
        <section id="review-inbox" aria-label="Review Inbox">
          Review Inbox
        </section>
      </LoopsOperationsView>,
    );

    await screen.findByRole('region', { name: 'Agent Runtime' });
    scrollIntoView.mockClear();

    window.history.replaceState(null, '', '#review-inbox');
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('clears a stale target before Operations is manually reopened', async () => {
    window.history.replaceState(null, '', '#agent-runtime');
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderWithIntl(
      <LoopsOperationsView>
        <section id="agent-runtime" aria-label="Agent Runtime">
          Agent Runtime
        </section>
      </LoopsOperationsView>,
    );

    await screen.findByRole('region', { name: 'Agent Runtime' });
    scrollIntoView.mockClear();

    window.history.replaceState(null, '', '#unrelated');
    fireEvent(window, new HashChangeEvent('hashchange'));

    const trigger = screen.getByRole('button', { name: 'Operations' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('opens management content for the agent runtime hash', async () => {
    window.history.replaceState(null, '', '#agent-runtime');
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderWithIntl(
      <LoopsOperationsView>
        <section id="agent-runtime" aria-label="Agent Runtime">
          Agent Runtime
        </section>
      </LoopsOperationsView>,
    );

    expect(await screen.findByRole('region', { name: 'Agent Runtime' })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(screen.getByRole('button', { name: 'Operations' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
