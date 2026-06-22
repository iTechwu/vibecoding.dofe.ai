import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import loopsMessages from '@/locales/en/loops.json';
import LoopsPage from './page';

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
                updated: '2026-06-20T00:00:00.000Z',
              },
              state: {
                phase: 'PHASE_4_IMPLEMENT',
                round: 2,
                paused: false,
                globalVerdict: undefined,
                updated: '2026-06-20T00:00:00.000Z',
              },
            },
            {
              issue: {
                id: 'issue-2',
                title: 'Update docs',
                status: 'OPEN',
                priority: 'P2',
                targetRepo: '/repo/docs',
                updated: '2026-06-20T00:00:00.000Z',
              },
              state: {
                phase: 'PHASE_2_REVIEW',
                round: 1,
                paused: true,
                globalVerdict: 'NEEDS-WORK',
                updated: '2026-06-20T00:00:00.000Z',
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
  useLoopsAgentRuntime: () => ({
    data: {
      body: {
        data: {
          summary: {
            running: 1,
            attention: 1,
            idle: 2,
            total: 4,
          },
          agents: [
            {
              id: 'spec-review-agent',
              label: 'Spec Review Agent',
              status: 'attention',
              phase: 'PHASE_2_REVIEW',
              supportedPhases: ['PHASE_2_REVIEW'],
              issueId: 'issue-2',
              issueTitle: 'Update docs',
              href: '/loops/issue-2',
              meta: 'Review · round 1',
              diagnostics: ['Spec draft is waiting for human review'],
              updated: '2026-06-20T00:00:00.000Z',
            },
            {
              id: 'implementation-agent',
              label: 'Implementation Agent',
              status: 'running',
              phase: 'PHASE_4_IMPLEMENT',
              supportedPhases: ['PHASE_4_IMPLEMENT'],
              issueId: 'issue-1',
              issueTitle: 'Fix checkout flow',
              href: '/loops/issue-1',
              meta: 'Implement · round 2',
              diagnostics: [],
              updated: '2026-06-20T00:00:00.000Z',
            },
            {
              id: 'shard-review-agent',
              label: 'Shard Review Agent',
              status: 'idle',
              phase: 'PHASE_5_REVIEW',
              supportedPhases: ['PHASE_5_REVIEW'],
              meta: 'Shard Review',
              diagnostics: [],
            },
            {
              id: 'global-review-agent',
              label: 'Global Review Agent',
              status: 'idle',
              phase: 'PHASE_7_GLOBAL_REVIEW',
              supportedPhases: ['PHASE_7_GLOBAL_REVIEW'],
              meta: 'Global Review',
              diagnostics: [],
            },
          ],
          diagnostics: [
            {
              id: 'spec-review-agent-issue-2-0',
              agentId: 'spec-review-agent',
              issueId: 'issue-2',
              title: 'Update docs',
              href: '/loops/issue-2',
              level: 'warning',
              reason: 'Spec draft is waiting for human review',
              meta: 'Review · round 1',
              updated: '2026-06-20T00:00:00.000Z',
            },
          ],
        },
      },
    },
  }),
  useLoopsCapabilities: () => ({
    data: {
      body: {
        data: {
          summary: {
            total: 3,
            done: 1,
            planned: 2,
            inProgress: 0,
          },
          capabilities: [
            {
              id: 'a2a-tool-registry',
              label: 'A2A / Tool Registry',
              category: 'tool',
              status: 'planned',
              summary: 'Expose agent-to-agent capabilities and tool contracts.',
              currentFoundation: ['Codex and Claude adapters exist.'],
              nextSteps: ['Define agent registry schema.'],
              risks: [],
              agentToolRegistry: {
                agents: [
                  {
                    id: 'codex-planner-reviewer',
                    label: 'Codex Planner / Reviewer',
                    provider: 'codex',
                    lifecycle: 'active',
                    responsibilities: ['Plan and review loop work.'],
                    supportedPhases: ['PHASE_1_SPEC', 'PHASE_5_REVIEW'],
                    permissions: ['read-repo', 'run-tests'],
                    toolIds: ['spec-shard-planner'],
                  },
                  {
                    id: 'claude-code-implementer',
                    label: 'Claude Code Implementer',
                    provider: 'claude-code',
                    lifecycle: 'active',
                    responsibilities: ['Implement approved shards.'],
                    supportedPhases: ['PHASE_4_IMPLEMENT'],
                    permissions: ['read-repo', 'write-repo', 'run-tests'],
                    toolIds: ['repo-code-editor'],
                  },
                ],
                tools: [
                  {
                    id: 'spec-shard-planner',
                    label: 'Spec / Shard Planner',
                    kind: 'artifact',
                    lifecycle: 'active',
                    ownerAgentIds: ['codex-planner-reviewer'],
                    permissions: ['read-repo'],
                    deterministicBoundary: 'Writes Loops planning artifacts through service.',
                    compatibility: { codex: true, claudeCode: false, thirdParty: 'planned' },
                  },
                  {
                    id: 'repo-code-editor',
                    label: 'Repository Code Editor',
                    kind: 'code-execution',
                    lifecycle: 'active',
                    ownerAgentIds: ['claude-code-implementer'],
                    permissions: ['write-repo'],
                    deterministicBoundary: 'Requires approved shard scope.',
                    compatibility: { codex: false, claudeCode: true, thirdParty: 'planned' },
                  },
                ],
                compatibilityChecks: [
                  {
                    id: 'phase-tool-ownership',
                    status: 'pass',
                    summary: 'Every active tool has an active owner.',
                  },
                ],
              },
            },
            {
              id: 'feishu-integration',
              label: 'Feishu Integration',
              category: 'integration',
              status: 'planned',
              summary: 'Support Feishu as an intake and notification channel.',
              currentFoundation: ['Feishu webhook notifications exist.'],
              nextSteps: ['Add signed webhook validation.'],
              risks: [],
            },
            {
              id: 'codex-claude-adapters',
              label: 'Codex / Claude Code Adapters',
              category: 'agent',
              status: 'done',
              summary: 'Primary agents are wired.',
              currentFoundation: ['Adapters exist.'],
              nextSteps: ['Expose model routing.'],
              risks: [],
            },
          ],
        },
      },
    },
  }),
  useLoopsMetrics: () => ({
    data: {
      body: {
        data: {
          health: {
            ok: true,
            root: '/repo/.loops',
            loops: 2,
            issues: 2,
            problems: [],
          },
          summary: {
            total: 2,
            active: 2,
            inLoop: 1,
            paused: 1,
            attention: 3,
            closed: 0,
          },
          phaseDistribution: [
            { phase: 'PHASE_4_IMPLEMENT', label: 'Implement', count: 1 },
            { phase: 'PHASE_2_REVIEW', label: 'Review', count: 1 },
          ],
          costSummary: {
            loops: 2,
            tripped: 1,
            totalCalls: 13,
            totalTokens: 1100,
            minCallsRemaining: 0,
            minTokensRemaining: 0,
          },
          riskQueue: [
            {
              issueId: 'issue-2',
              title: 'Update docs',
              level: 'critical',
              reason: 'Cost guard tripped',
              phase: 'PHASE_2_REVIEW',
              priority: 'P2',
              status: 'OPEN',
              href: '/loops/issue-2',
            },
          ],
          actionQueue: [
            {
              issueId: 'issue-2',
              title: 'Update docs',
              action: 'resume',
              label: 'Resume loop',
              priority: 'P2',
              phase: 'PHASE_2_REVIEW',
              href: '/loops/issue-2',
            },
          ],
          requirementsCoverage: {
            total: 2,
            accepted: 1,
            reviewed: 0,
            tested: 0,
            implemented: 0,
            planned: 0,
            missing: 1,
            percent: 50,
          },
          traceSummary: {
            total: 2,
            recent: 2,
            lastEventAt: '2026-06-20T00:00:00.000Z',
            eventTypes: [{ type: 'LOOP_STEP', count: 1 }],
          },
          resumeSummary: {
            resumableShards: 1,
            affectedIssues: 1,
          },
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
  useLoopsWorkspaces: () => ({
    data: {
      body: {
        data: {
          current: 'default',
          workspaces: [
            {
              workspaceId: 'default',
              root: '/repo/app',
              status: 'VALIDATED',
              isDefault: true,
              selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
            },
          ],
        },
      },
    },
  }),
  useUpsertLoopsWorkspace: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDetectLoopsRuntime: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePullLoopsImage: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRetryLoopsAgentRuntime: () => vi.fn(),
}));

function IntlWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ loops: loopsMessages }}>
      {children}
    </NextIntlClientProvider>
  );
}

function renderWithIntl(ui: React.ReactElement) {
  return render(ui, { wrapper: IntlWrapper });
}

describe('LoopsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T01:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the control plane dashboard from loop metrics', () => {
    renderWithIntl(<LoopsPage />);

    expect(screen.getByText('Agent Delivery Console')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('Phase Distribution')).toBeInTheDocument();
    expect(screen.getByText('Risk Queue')).toBeInTheDocument();
    expect(screen.getByText('Agent Runtime')).toBeInTheDocument();
    expect(screen.getByText('1 running · 1 need attention · 4 registered')).toBeInTheDocument();
    expect(screen.getByText('Implementation Agent')).toBeInTheDocument();
    expect(screen.getByText('Spec Review Agent')).toBeInTheDocument();
    expect(screen.getByText('Runtime Diagnostics')).toBeInTheDocument();
    expect(screen.getAllByText('Spec draft is waiting for human review').length).toBeGreaterThan(0);
    expect(screen.getByText('Action Queue')).toBeInTheDocument();
    expect(screen.getByText('Review Inbox')).toBeInTheDocument();
    expect(screen.getByText('2 human review and takeover items')).toBeInTheDocument();
    expect(screen.getByText('Trace Summary')).toBeInTheDocument();
    expect(screen.getByText('Resume Summary')).toBeInTheDocument();
    expect(screen.getByText('Capability Registry')).toBeInTheDocument();
    expect(screen.getByText('A2A / Tool Registry')).toBeInTheDocument();
    expect(screen.getByText('Agent Registry')).toBeInTheDocument();
    expect(screen.getByText('Codex Planner / Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Tool Registry')).toBeInTheDocument();
    expect(screen.getByText('Repository Code Editor')).toBeInTheDocument();
    expect(screen.getByText('Compatibility Checks')).toBeInTheDocument();
    expect(screen.getByText('phase-tool-ownership')).toBeInTheDocument();
    expect(screen.getByText('Feishu Integration')).toBeInTheDocument();
    expect(screen.getByText('Aging Queue')).toBeInTheDocument();
    expect(screen.getByText('Warning at 24h stale; critical at 72h stale.')).toBeInTheDocument();
    expect(screen.getAllByText(/73h stale/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fix checkout flow').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cost guard tripped').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resume loop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Review needed').length).toBeGreaterThan(0);
    expect(screen.getByText('HUMAN INTERVENTION')).toBeInTheDocument();
  });

  it('hydrates without time-dependent markup mismatches', async () => {
    vi.setSystemTime(new Date('2026-06-21T01:00:00.000Z'));
    const html = renderToString(
      <IntlWrapper>
        <LoopsPage />
      </IntlWrapper>,
    );
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const originalError = console.error;
    const consoleError = vi.fn();
    console.error = consoleError;

    try {
      vi.setSystemTime(new Date('2026-06-23T01:00:00.000Z'));
      hydrateRoot(
        container,
        <IntlWrapper>
          <LoopsPage />
        </IntlWrapper>,
      );
      await vi.waitFor(() => {
        expect(consoleError).not.toHaveBeenCalledWith(
          expect.stringContaining(
            "Hydration failed because the server rendered text didn't match the client",
          ),
          expect.anything(),
        );
      });
    } finally {
      console.error = originalError;
    }
  });
});
