import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import { HomeWorkbench } from './home-workbench';

const refetch = vi.fn();

const queryState = {
  list: {
    data: {
      body: {
        data: {
          list: [
            {
              issue: {
                id: 'running',
                title: 'Ship account settings',
                status: 'IN_LOOP',
                priority: 'P1',
              },
              state: { phase: 'PHASE_4_IMPLEMENT', paused: false },
            },
            {
              issue: {
                id: 'review',
                title: 'Review onboarding copy',
                status: 'OPEN',
                priority: 'P2',
              },
              state: { phase: 'PHASE_2_REVIEW', paused: false },
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        },
      },
    },
    isLoading: false,
    isError: false,
    refetch,
  },
  metrics: {
    data: {
      body: {
        data: {
          actionQueue: [
            {
              issueId: 'review',
              title: 'Review onboarding copy',
              href: '/loops/review',
              action: 'review-spec',
              label: 'Review spec',
              priority: 'P2',
              phase: 'PHASE_2_REVIEW',
              nextActionCategory: 'decision',
            },
          ],
        },
      },
    },
    isLoading: false,
    isError: false,
    refetch,
  },
  notifications: {
    data: {
      body: {
        data: {
          notifications: [],
        },
      },
    },
    isLoading: false,
    isError: false,
    refetch,
  },
};

vi.mock('@/lib/api/contracts/hooks', () => ({
  useLoopsList: () => queryState.list,
  useLoopsMetrics: () => queryState.metrics,
  useLoopsNotifications: () => queryState.notifications,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@repo/ui', () => ({
  Button: ({ asChild, children, ...props }: ComponentProps<'button'> & { asChild?: boolean }) =>
    asChild ? children : <button {...props}>{children}</button>,
  Skeleton: (props: ComponentProps<'div'>) => <div {...props} />,
}));

function renderWorkbench() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      <HomeWorkbench />
    </NextIntlClientProvider>,
  );
}

describe('HomeWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.list.isLoading = false;
    queryState.list.isError = false;
    queryState.metrics.isLoading = false;
    queryState.metrics.isError = false;
    queryState.notifications.isLoading = false;
    queryState.notifications.isError = false;
    queryState.list.data = {
      body: {
        data: {
          list: [
            {
              issue: {
                id: 'running',
                title: 'Ship account settings',
                status: 'IN_LOOP',
                priority: 'P1',
              },
              state: { phase: 'PHASE_4_IMPLEMENT', paused: false },
            },
            {
              issue: {
                id: 'review',
                title: 'Review onboarding copy',
                status: 'OPEN',
                priority: 'P2',
              },
              state: { phase: 'PHASE_2_REVIEW', paused: false },
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        },
      },
    };
  });

  it('renders continuation, review, and recent issue links from existing hook data', () => {
    renderWorkbench();

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Continue' })).getByRole('link'),
    ).toHaveAttribute('href', '/loops/running');
    expect(screen.getByRole('link', { name: 'Continue Loop' })).toHaveAttribute(
      'href',
      '/loops/running',
    );
    expect(
      screen.getByRole('link', { name: 'Open review: Review onboarding copy' }),
    ).toHaveAttribute('href', '/loops/review');
  });

  it('shows a skeleton while its workbench data is unresolved', () => {
    queryState.list.isLoading = true;

    renderWorkbench();

    expect(screen.getByLabelText(loopsMessages.dashboard.home.loadingLabel)).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('offers retry when the issue list fails', () => {
    queryState.list.isError = true;

    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load your workbench.');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the issue list available when review metrics fail', () => {
    queryState.metrics.isError = true;

    renderWorkbench();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue Loop' })).toHaveAttribute(
      'href',
      '/loops/running',
    );
    expect(screen.getByText(loopsMessages.dashboard.home.reviewUnavailable)).toBeInTheDocument();
  });

  it('keeps the issue list available when review notifications fail', () => {
    queryState.notifications.isError = true;

    renderWorkbench();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue Loop' })).toHaveAttribute(
      'href',
      '/loops/running',
    );
    expect(screen.getByText(loopsMessages.dashboard.home.reviewUnavailable)).toBeInTheDocument();
  });

  it('offers a new issue action when no issues exist', () => {
    queryState.list.data = {
      body: { data: { list: [], total: 0, page: 1, limit: 20 } },
    };

    renderWorkbench();

    expect(screen.getByText('No issues yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New Issue' })).toHaveAttribute('href', '/loops/new');
  });

  it('does not offer a continuation action when every listed issue is terminal', () => {
    queryState.list.data = {
      body: {
        data: {
          list: [
            {
              issue: {
                id: 'archived',
                title: 'Archived issue',
                status: 'ARCHIVED',
                priority: 'P2',
              },
              state: { phase: 'CLOSED', paused: false },
            },
            {
              issue: {
                id: 'rejected',
                title: 'Rejected issue',
                status: 'REJECTED',
                priority: 'P2',
              },
              state: { phase: 'CLOSED', paused: false },
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        },
      },
    };

    renderWorkbench();

    expect(screen.queryByRole('region', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue Loop' })).not.toBeInTheDocument();
    expect(screen.getByText('Archived issue')).toBeInTheDocument();
  });
});
