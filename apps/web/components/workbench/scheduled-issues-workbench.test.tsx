import { fireEvent, render, screen } from '@testing-library/react';
import type { LoopIssueListItem } from '@repo/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import { ScheduledIssuesWorkbench } from './scheduled-issues-workbench';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const items = [
  {
    issue: { id: 'run', title: 'Fix checkout', status: 'IN_LOOP', priority: 'P1' },
    state: { phase: 'PHASE_4_IMPLEMENT', paused: false },
  },
  {
    issue: { id: 'review', title: 'Review recovery plan', status: 'OPEN', priority: 'P0' },
    state: { phase: 'PHASE_2_REVIEW', paused: false },
  },
] as LoopIssueListItem[];

function renderWorkbench(
  overrides: Partial<React.ComponentProps<typeof ScheduledIssuesWorkbench>> = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      <ScheduledIssuesWorkbench
        isError={false}
        isLoading={false}
        items={items}
        onRetry={vi.fn()}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe('ScheduledIssuesWorkbench', () => {
  it('orders review work before active work and filters by title', () => {
    renderWorkbench();
    expect(screen.getByRole('heading', { name: 'Scheduled' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Review recovery plan');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search issues' }), {
      target: { value: 'checkout' },
    });
    expect(screen.getByText('Fix checkout')).toBeInTheDocument();
    expect(screen.queryByText('Review recovery plan')).not.toBeInTheDocument();
  });

  it('offers a retry action when the inbox cannot load', () => {
    const onRetry = vi.fn();
    renderWorkbench({ isError: true, onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load scheduled work.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
