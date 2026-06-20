import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoopsPage from './page';

vi.mock('next/link', () => ({
  default: ({
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

const mutate = vi.fn();

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
                status: 'IN_LOOP',
                priority: 'P0',
                targetRepo: '/repo/app',
              },
              state: {
                phase: 'PHASE_4_IMPLEMENT',
                round: 2,
                paused: false,
                globalVerdict: undefined,
              },
            },
            {
              issue: {
                id: 'issue-2',
                title: 'Update docs',
                status: 'OPEN',
                priority: 'P2',
                targetRepo: '/repo/docs',
              },
              state: {
                phase: 'PHASE_2_REVIEW',
                round: 1,
                paused: true,
                globalVerdict: 'NEEDS-WORK',
              },
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        },
      },
    },
  }),
  useLoopsDoctor: () => ({
    data: {
      body: {
        data: {
          ok: true,
          root: '/repo/.loops',
          loops: 2,
          issues: 2,
          problems: [],
        },
      },
    },
  }),
  useLoopsCost: () => ({
    data: {
      body: {
        data: {
          loops: [
            {
              issueId: 'issue-1',
              costTokens: 100,
              costCalls: 3,
              tokenCap: 1000,
              callCap: 10,
              tokensRemaining: 900,
              callsRemaining: 7,
              paused: false,
              tripped: false,
            },
            {
              issueId: 'issue-2',
              costTokens: 1000,
              costCalls: 10,
              tokenCap: 1000,
              callCap: 10,
              tokensRemaining: 0,
              callsRemaining: 0,
              paused: true,
              tripped: true,
            },
          ],
        },
      },
    },
  }),
  useLoopsLogs: () => ({
    data: {
      body: {
        data: {
          entries: [
            {
              ts: '2026-06-20T00:00:00.000Z',
              type: 'LOOP_STEP',
              issue: 'issue-1',
              payload: {},
            },
          ],
        },
      },
    },
  }),
  useLoopsNotifications: () => ({
    data: {
      body: {
        data: {
          notifications: [
            {
              id: 'note-1',
              issueId: 'issue-2',
              channel: 'web',
              kind: 'HUMAN_INTERVENTION',
              recipient: 'human',
              title: 'Review needed',
              body: 'Please review',
              status: 'RECORDED',
              created: '2026-06-20T00:00:00.000Z',
            },
          ],
        },
      },
    },
  }),
  useResumeLoops: () => ({ isPending: false, mutate }),
}));

describe('LoopsPage', () => {
  it('renders the control plane dashboard from loop telemetry', () => {
    render(<LoopsPage />);

    expect(screen.getByText('Agent Delivery Console')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('Phase Distribution')).toBeInTheDocument();
    expect(screen.getByText('Risk Queue')).toBeInTheDocument();
    expect(screen.getAllByText('Fix checkout flow').length).toBeGreaterThan(0);
    expect(screen.getByText('Cost guard tripped')).toBeInTheDocument();
    expect(screen.getByText('Review needed')).toBeInTheDocument();
  });
});
