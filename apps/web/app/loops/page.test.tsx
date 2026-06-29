import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className={className} href={href} {...props}>
      {children}
    </a>
  ),
}));

const mutate = vi.fn();
const requestRecipeAdminActionMutate = vi.fn();
const governLearningMutate = vi.fn();
const autoMergeWorkerMutate = vi.fn();
const learningIndexWorkerMutate = vi.fn();
const loopBenchTrendWorkerMutate = vi.fn();
const pullImageMutate = vi.fn().mockResolvedValue({
  body: {
    data: {
      agent: 'claude-code',
      image: 'dofe-ai/sandbox:latest',
      status: 'pulled',
      message: 'Pulled image.',
    },
  },
});
const retryAgentRuntime = vi.fn();

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
                created: '2026-06-20T00:00:00.000Z',
                targetRepo: '/repo/app',
                updated: '2026-06-20T00:00:00.000Z',
                sourceChannel: 'web',
                sourceKind: 'web_form',
                submitterId: 'u1',
                submitterName: 'Ada',
              },
              state: {
                phase: 'PHASE_4_IMPLEMENT',
                round: 2,
                shardsDone: 1,
                shardsTotal: 3,
                paused: false,
                globalVerdict: undefined,
                updated: '2026-06-20T00:00:00.000Z',
              },
              runtimeSecurityExceptions: [
                {
                  id: 'runtime-security-test-record-shard-1-r2-0',
                  testRecordId: 'test-record-shard-1-r2',
                  shardId: 'shard-1',
                  round: 2,
                  level: 'warning',
                  reason: 'Command "pnpm test && rm -rf /tmp/out" was blocked by runtime policy.',
                  evidence: 'runtime-security:command-policy · TEST-FAIL',
                  command: 'pnpm test && rm -rf /tmp/out',
                  created: '2026-06-20T00:00:00.000Z',
                },
              ],
            },
            {
              issue: {
                id: 'issue-2',
                title: 'Update docs',
                status: 'OPEN',
                priority: 'P2',
                created: '2026-06-19T00:00:00.000Z',
                targetRepo: '/repo/docs',
                updated: '2026-06-20T00:00:00.000Z',
                sourceChannel: 'web',
                sourceKind: 'web_form',
                submitterId: 'u2',
                submitterName: 'Grace',
              },
              state: {
                phase: 'PHASE_2_REVIEW',
                round: 1,
                shardsDone: 0,
                shardsTotal: 0,
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
          runtimes: [
            {
              agent: 'codex',
              preferredMode: 'local-cli',
              selected: { mode: 'local-cli', status: 'ready', workspaceRequired: false },
              checks: [],
            },
            {
              agent: 'claude-code',
              preferredMode: 'docker',
              selected: { mode: 'docker', status: 'missing', workspaceRequired: true },
              docker: {
                mode: 'docker',
                status: 'missing',
                command: 'docker run dofe-ai/sandbox:latest claude',
                workspaceRequired: true,
              },
              checks: [
                {
                  code: 'DOCKER_IMAGE_MISSING',
                  level: 'warning',
                  message: 'Docker image dofe-ai/sandbox:latest is missing.',
                  action: 'pull-image',
                },
              ],
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
  useLoopsCiChecks: () => ({
    data: {
      body: {
        data: {
          list: [
            {
              id: 'github-delivery-evidence',
              name: 'DofeAI Delivery Evidence',
              provider: 'github',
              status: 'ready',
              tenantId: 'tenant-1',
              permissions: ['vibecoding:loops:operate'],
              requiredPermission: 'vibecoding:loops:operate',
              lastPublication: undefined,
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    },
  }),
  useLoopsCiCheckPublications: () => ({
    data: {
      body: {
        data: {
          latest: {
            artifactRef:
              '.loops/ci-checks/github-delivery-evidence/publications/abc1234567-2026-06-23T01-00-00.000Z.json',
            integrationId: 'github-delivery-evidence',
            provider: 'github',
            headSha: 'abc1234567',
            checkRunId: 'check-run-11',
            url: 'https://github.com/dofe/repo/runs/11',
            outcome: 'published',
            issueId: 'issue-1',
            prId: '42',
            evidenceBacklink: 'https://vibecoding.dofe.ai/loops/issue-1/delivery-evidence',
            workPackageCommitMap: [
              {
                workPackageId: 'shard-1',
                title: 'Checkout fix',
                commitSha: 'abc123456789',
                branch: 'loops/issue-1',
                files: ['apps/web/app/checkout/page.tsx'],
              },
            ],
            request: {
              name: 'DofeAI Delivery Evidence',
              detailsUrl: 'https://dofe.ai/loops/issue-1/evidence',
              evidenceBacklink: 'https://vibecoding.dofe.ai/loops/issue-1/delivery-evidence',
            },
            publishedAt: '2026-06-23T01:00:00.000Z',
          },
          entries: [
            {
              artifactRef:
                '.loops/ci-checks/github-delivery-evidence/publications/abc1234567-2026-06-23T01-00-00.000Z.json',
              integrationId: 'github-delivery-evidence',
              provider: 'github',
              headSha: 'abc1234567',
              checkRunId: 'check-run-11',
              url: 'https://github.com/dofe/repo/runs/11',
              outcome: 'published',
              issueId: 'issue-1',
              prId: '42',
              evidenceBacklink: 'https://vibecoding.dofe.ai/loops/issue-1/delivery-evidence',
              workPackageCommitMap: [
                {
                  workPackageId: 'shard-1',
                  title: 'Checkout fix',
                  commitSha: 'abc123456789',
                  branch: 'loops/issue-1',
                  files: ['apps/web/app/checkout/page.tsx'],
                },
              ],
              request: {
                name: 'DofeAI Delivery Evidence',
                detailsUrl: 'https://dofe.ai/loops/issue-1/evidence',
                evidenceBacklink: 'https://vibecoding.dofe.ai/loops/issue-1/delivery-evidence',
              },
              publishedAt: '2026-06-23T01:00:00.000Z',
            },
          ],
        },
      },
    },
  }),
  useLoopsAssetPermissions: () => ({
    data: {
      body: {
        data: {
          identity: {
            userId: 'sso-user-42',
            teamId: 'team-1',
            tenantId: 'tenant-1',
            isSuperAdmin: false,
          },
          source: 'sso',
          permissions: ['vibecoding:loops:read', 'vibecoding:loops:create'],
          roles: ['MEMBER'],
          summary: { total: 3, granted: 1, blocked: 2 },
          assets: [
            {
              assetKind: 'blueprint',
              assetId: 'delivery-blueprints',
              label: 'Delivery blueprints',
              scope: 'tenant',
              requiredAction: 'create',
              granted: true,
              sourcePermission: 'vibecoding:loops:create',
            },
            {
              assetKind: 'runtime-backend',
              assetId: 'codex-claude-runtime-backends',
              label: 'Codex / Claude Code runtime backends',
              scope: 'workspace',
              requiredAction: 'operate',
              granted: false,
              sourcePermission: 'vibecoding:loops:operate',
            },
            {
              assetKind: 'mcp-server',
              assetId: 'mcp-server-registry',
              label: 'MCP server registry',
              scope: 'tenant',
              requiredAction: 'admin',
              granted: false,
              sourcePermission: 'vibecoding:loops:admin',
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
              action: 'run-step',
              label: 'Continue loop',
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
          loopBenchTrend: {
            historyCount: 2,
            latest: {
              id: 'loop-bench-1782262800000',
              capturedAt: '2026-06-23T01:00:00.000Z',
              artifactRef: '.loops/bench-trends/2026-06-23T01-00-00-000Z.json',
              loopCount: 2,
              metrics: {
                firstPassReviewRate: 50,
                browserQaRegressionRate: 0,
                secondOpinionConflictRate: 0,
                releaseBlockerRate: 50,
                runtimeViolationRate: 50,
                learningReuseRate: 50,
                canaryPassRate: 50,
              },
              previousMetrics: {
                firstPassReviewRate: 40,
                browserQaRegressionRate: 10,
                secondOpinionConflictRate: 0,
                releaseBlockerRate: 60,
                runtimeViolationRate: 50,
                learningReuseRate: 25,
                canaryPassRate: 40,
              },
              deltas: {
                firstPassReviewRate: 10,
                browserQaRegressionRate: -10,
                secondOpinionConflictRate: 0,
                releaseBlockerRate: -10,
                runtimeViolationRate: 0,
                learningReuseRate: 25,
                canaryPassRate: 10,
              },
            },
          },
        },
      },
    },
  }),
  useRunLoopBenchTrendWorker: () => ({
    isPending: false,
    mutate: loopBenchTrendWorkerMutate,
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
  useRequestRecipeAdminAction: () => ({
    isPending: false,
    mutate: requestRecipeAdminActionMutate,
  }),
  useResumeLoops: () => ({ isPending: false, mutate }),
  useGovernLoopLearning: () => ({ isPending: false, mutate: governLearningMutate }),
  useRunLoopLearningAutoMergeWorker: () => ({
    isPending: false,
    mutate: autoMergeWorkerMutate,
  }),
  useRunLoopLearningIndexWorker: () => ({
    isPending: false,
    mutate: learningIndexWorkerMutate,
  }),
  useLoopsWorkspaces: () => ({
    data: {
      body: {
        data: {
          current: 'default',
          recentLearnings: [
            {
              id: 'learning-test-policy',
              workspaceId: 'default',
              repo: '/repo/app',
              kind: 'test_policy',
              summary: 'Run unit and type-check before dashboard changes.',
              fingerprint: 'learning-test-policy-fingerprint',
              tags: ['test', 'policy', 'dashboard'],
              similarLearningIds: ['learning-ownership'],
              evidenceIds: ['test-record-1'],
              confidence: 0.92,
              createdAt: '2026-06-23T00:00:00.000Z',
            },
            {
              id: 'learning-ownership',
              workspaceId: 'default',
              repo: '/repo/docs',
              kind: 'ownership',
              summary: 'Docs changes usually touch docs/0623/gstack.',
              fingerprint: 'learning-ownership-fingerprint',
              tags: ['docs', 'gstack', 'dashboard'],
              similarLearningIds: ['learning-test-policy'],
              evidenceIds: ['impl-1'],
              confidence: 0.76,
              lastUsedAt: '2026-06-23T00:30:00.000Z',
              createdAt: '2026-06-22T00:00:00.000Z',
            },
          ],
          learningGovernance: {
            dismissed: [],
            merges: [],
            deprecated: [],
            autoMergeCandidates: [
              {
                sourceLearningId: 'learning-test-policy',
                targetLearningId: 'learning-ownership',
                status: 'pending-approval',
                reason: 'Similar fingerprint',
                createdAt: '2026-06-23T00:45:00.000Z',
              },
            ],
          },
          learningIndex: {
            generatedAt: '2026-06-23T01:20:00.000Z',
            artifactRef: '.loops/learnings/cross-workspace-index.json',
            summary: {
              total: 2,
              workspaces: 1,
              repos: 2,
              duplicateFingerprints: 1,
              reusable: 1,
            },
            entries: [
              {
                learningId: 'learning-test-policy',
                workspaceId: 'default',
                repo: '/repo/app',
                kind: 'test_policy',
                fingerprint: 'learning-test-policy-fingerprint',
                tags: ['test', 'policy', 'dashboard'],
                confidence: 0.92,
                evidenceIds: ['test-record-1'],
                recallCount: 0,
                createdAt: '2026-06-23T00:00:00.000Z',
              },
            ],
          },
          workspaces: [
            {
              workspaceId: 'default',
              root: '/repo/app',
              status: 'VALIDATED',
              isDefault: true,
              selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
              rules: {
                present: 2,
                total: 4,
                diagnostics: [
                  {
                    id: 'rules-overlap',
                    level: 'warning',
                    message: 'Multiple agent-readable rule sources are present; verify precedence.',
                    evidence: 'AGENTS.md, CLAUDE.md',
                  },
                  {
                    id: 'missing-cline-rules',
                    level: 'info',
                    message: 'Cline rules are not present.',
                    evidence: '.clinerules',
                  },
                ],
                rules: [
                  {
                    id: 'agents',
                    label: 'AGENTS.md',
                    path: 'AGENTS.md',
                    status: 'present',
                    summary: '# AGENTS.md',
                    updated: '2026-06-20T00:00:00.000Z',
                  },
                  {
                    id: 'claude',
                    label: 'CLAUDE.md',
                    path: 'CLAUDE.md',
                    status: 'present',
                    summary: '# CLAUDE.md',
                    updated: '2026-06-20T00:00:00.000Z',
                  },
                  {
                    id: 'cursor-rules',
                    label: 'Cursor rules',
                    path: '.cursor/rules',
                    status: 'missing',
                  },
                  {
                    id: 'cline-rules',
                    label: 'Cline rules',
                    path: '.clinerules',
                    status: 'missing',
                  },
                ],
              },
            },
          ],
        },
      },
    },
  }),
  useUpsertLoopsWorkspace: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDetectLoopsRuntime: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePullLoopsImage: () => ({ isPending: false, mutateAsync: pullImageMutate }),
  useRetryLoopsAgentRuntime: () => retryAgentRuntime,
  getBrowserQaArtifactUrl: (_issueId: string, artifactPath: string) =>
    `http://localhost:13100/loops/${_issueId}/browser-qa/artifact/${artifactPath}`,
  useWorkspaceRecipes: () => ({
    data: { body: { data: { list: [], total: 0, page: 1, limit: 20 } } },
    isLoading: false,
  }),
  useLoopBenchDrilldown: () => ({
    data: { body: { data: { metrics: [], period: '30d', filters: {} } } },
    isLoading: false,
  }),
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
  it('keeps operator focus create fallback copy localized', () => {
    expect(loopsMessages.dashboard.operatorFocus.title.create).toBe('Create a new Loop');
    expect(loopsMessages.dashboard.operatorFocus.meta.create).toBe(
      'No active operator actions are waiting.',
    );
    expect(loopsMessages.dashboard.operatorFocus.action.create).toBe('Create Loop');
    expect(loopsMessages.dashboard.operatorFocus.ctaLabel).toBe('{action}: {title}');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-23T01:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the control plane dashboard from loop metrics', async () => {
    renderWithIntl(<LoopsPage />);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('Agent Delivery Console')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('Workspace Rules')).toBeInTheDocument();
    expect(screen.getByText('2/4 present')).toBeInTheDocument();
    expect(screen.getByText('AGENTS.md · present')).toBeInTheDocument();
    expect(screen.getByText('CLAUDE.md · present')).toBeInTheDocument();
    expect(screen.getByText('Cline rules · missing')).toBeInTheDocument();
    expect(
      screen.getByText('Multiple agent-readable rule sources are present; verify precedence.'),
    ).toBeInTheDocument();
    expect(screen.getByText('AGENTS.md, CLAUDE.md')).toBeInTheDocument();
    expect(screen.getByText('Delivery Guide')).toBeInTheDocument();
    expect(screen.getByText('Create Loop')).toBeInTheDocument();
    expect(screen.getByText('Review decisions')).toBeInTheDocument();
    expect(screen.getByText('Resolve exceptions')).toBeInTheDocument();
    expect(screen.getByText('Audit evidence')).toBeInTheDocument();
    expect(screen.getByText('Phase Distribution')).toBeInTheDocument();
    expect(screen.getByText('Risk Queue')).toBeInTheDocument();
    expect(screen.getByText('Agent Runtime')).toBeInTheDocument();
    expect(screen.getByText('1 running · 1 need attention · 4 registered')).toBeInTheDocument();
    expect(screen.getByText('Implementation Agent')).toBeInTheDocument();
    expect(screen.getByText('Spec Review Agent')).toBeInTheDocument();
    expect(
      screen.getAllByText('Docker image dofe-ai/sandbox:latest is missing.').length,
    ).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pull image' }));
      await Promise.resolve();
    });
    expect(pullImageMutate).toHaveBeenCalledWith({
      params: { workspaceId: 'default' },
      body: { agent: 'claude-code' },
    });
    expect(retryAgentRuntime).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Runtime Diagnostics')).toBeInTheDocument();
    expect(screen.getAllByText('Spec draft is waiting for human review').length).toBeGreaterThan(0);
    const loopBoardRegion = screen.getByRole('region', { name: 'Loop Board' });
    expect(loopBoardRegion).toBeInTheDocument();
    expect(
      within(loopBoardRegion).getByText(
        '2 issues grouped by delivery stage, human gate, branch, and evidence',
      ),
    ).toBeInTheDocument();
    expect(within(loopBoardRegion).getByText('Backlog')).toBeInTheDocument();
    expect(screen.getAllByText('Spec Review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getAllByText('Code').length).toBeGreaterThan(0);
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
    expect(screen.getAllByText('loops/issue-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending PR').length).toBeGreaterThan(0);
    expect(screen.getByText('1/3 shards')).toBeInTheDocument();
    expect(screen.getByText('Workflow Recipe')).toBeInTheDocument();
    expect(screen.getByText('Trend snapshot')).toBeInTheDocument();
    expect(screen.getByText('2 snapshots')).toBeInTheDocument();
    expect(
      screen.getByText('2 loops · first-pass 50% · canary 50% · first-pass delta 10 pts'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('.loops/bench-trends/2026-06-23T01-00-00-000Z.json'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run trend worker' }));
    expect(loopBenchTrendWorkerMutate).toHaveBeenCalledWith({ body: {} });
    expect(
      screen.getByText(
        '2 loops mapped to Plan → Build → Review → QA → Ship · 1 blocked · 0 release-ready',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Browser QA')).toBeInTheDocument();
    expect(screen.getByText('Browser QA gate planned')).toBeInTheDocument();
    expect(screen.getByText('Release gate')).toBeInTheDocument();
    expect(screen.getByText('Release gate planned')).toBeInTheDocument();
    expect(screen.getByText('Review Gates')).toBeInTheDocument();
    expect(screen.getByText('1/4 passed · 2 pending · 1 blocked')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
    expect(screen.getByText('Learning Memory')).toBeInTheDocument();
    expect(screen.getByText('2 reusable learnings in this workspace')).toBeInTheDocument();
    expect(screen.getByText('Top learnings')).toBeInTheDocument();
    expect(screen.getByText('Stale learnings')).toBeInTheDocument();
    expect(screen.getByText('Pending approvals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run merge worker' }));
    expect(autoMergeWorkerMutate).toHaveBeenCalledWith({ body: {} });
    expect(screen.getByText('Cross-workspace index')).toBeInTheDocument();
    expect(
      screen.getByText('2 learnings · 1 workspaces · 2 repos · 1 duplicates · 1 reusable'),
    ).toBeInTheDocument();
    expect(screen.getByText('.loops/learnings/cross-workspace-index.json')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run index worker' }));
    expect(learningIndexWorkerMutate).toHaveBeenCalledWith({ body: {} });
    expect(screen.getAllByText('Test Policy').length).toBeGreaterThan(0);
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(
      screen.getAllByText('Run unit and type-check before dashboard changes.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('1 similar suggestions')).toBeInTheDocument();
    const mergeButton = screen.getAllByRole('button', { name: 'Merge' })[0];
    expect(mergeButton).toBeDefined();
    fireEvent.click(mergeButton!);
    expect(governLearningMutate).toHaveBeenCalledWith({
      params: { learningId: 'learning-test-policy' },
      body: {
        action: 'merge',
        actor: 'dashboard',
        targetLearningId: 'learning-ownership',
        reason: 'Merged from dashboard stale learning queue into top learning',
      },
    });
    const dismissButton = screen.getAllByRole('button', { name: 'Dismiss' })[0];
    expect(dismissButton).toBeDefined();
    fireEvent.click(dismissButton!);
    expect(governLearningMutate).toHaveBeenLastCalledWith({
      params: { learningId: 'learning-test-policy' },
      body: {
        action: 'dismiss',
        actor: 'dashboard',
        reason: 'Dismissed from dashboard stale learning queue',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(governLearningMutate).toHaveBeenLastCalledWith({
      params: { learningId: 'learning-test-policy' },
      body: {
        action: 'approve-merge',
        actor: 'dashboard',
        targetLearningId: 'learning-ownership',
        reason: 'Approved from dashboard learning queue',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(governLearningMutate).toHaveBeenLastCalledWith({
      params: { learningId: 'learning-test-policy' },
      body: {
        action: 'reject-merge',
        actor: 'dashboard',
        targetLearningId: 'learning-ownership',
        reason: 'Rejected from dashboard learning queue',
      },
    });
    expect(screen.getByText('1 specs need decision')).toBeInTheDocument();
    expect(screen.getByText('1 blocked by exception')).toBeInTheDocument();
    const operatorFocus = screen.getByRole('region', { name: 'Review needed' });
    expect(within(operatorFocus).getByText('Operator focus')).toBeInTheDocument();
    expect(within(operatorFocus).getByText('Review needed')).toBeInTheDocument();
    expect(
      within(operatorFocus).getByRole('link', { name: 'Needs human input: Review needed' }),
    ).toHaveAttribute('href', '/loops/issue-2');
    const exceptionCenter = screen.getByRole('region', { name: 'Exception Center' });
    expect(
      within(exceptionCenter).getByText('1 running · 0 queued · 2 failed · capacity 4'),
    ).toBeInTheDocument();
    expect(within(exceptionCenter).getAllByText('Eval hard gate').length).toBeGreaterThan(0);
    expect(screen.getByText('Security review planned')).toBeInTheDocument();
    expect(screen.getByText('CI Evidence Publications')).toBeInTheDocument();
    expect(screen.getByText('1 publications · latest status: published')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('check-run-11')).toBeInTheDocument();
    expect(screen.getAllByText('issue-1').length).toBeGreaterThan(0);
    expect(screen.getByText('Checkout fix')).toBeInTheDocument();
    expect(screen.getByText('abc123456789')).toBeInTheDocument();
    expect(screen.getByText('1 files · apps/web/app/checkout/page.tsx')).toBeInTheDocument();
    const releaseReadiness = screen.getByRole('region', { name: 'Release Readiness' });
    expect(
      within(releaseReadiness).getByText('0 ready · 0 need attention · 0 blocked'),
    ).toBeInTheDocument();
    expect(
      within(releaseReadiness).getByText('No loops are near release yet.'),
    ).toBeInTheDocument();
    const triggerPortfolio = screen.getByRole('region', { name: 'Trigger Portfolio' });
    expect(
      within(triggerPortfolio).getByText('2 issues from 1 sources across 2 repositories'),
    ).toBeInTheDocument();
    expect(within(triggerPortfolio).getByText('Sources')).toBeInTheDocument();
    expect(within(triggerPortfolio).getAllByText('web/web_form').length).toBeGreaterThan(0);
    expect(
      within(triggerPortfolio).getByText('Ada · 2026-06-20T00:00:00.000Z'),
    ).toBeInTheDocument();
    const repoContext = screen.getByRole('region', { name: 'Repo Context Map' });
    expect(
      within(repoContext).getByText('2 issues across 2 repositories · 1 blocked'),
    ).toBeInTheDocument();
    expect(within(repoContext).getAllByText('/repo/app').length).toBeGreaterThan(0);
    expect(within(repoContext).getAllByText('/repo/docs').length).toBeGreaterThan(0);
    expect(within(repoContext).getAllByText('Implement · 1').length).toBeGreaterThan(0);
    expect(within(repoContext).getAllByText('Review · 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Exception Center')).toBeInTheDocument();
    expect(screen.getByText('1 running · 0 queued · 2 failed · capacity 4')).toBeInTheDocument();
    expect(screen.getByText('Adjust budget or reduce scope')).toBeInTheDocument();
    expect(screen.getByText('Review command evidence')).toBeInTheDocument();
    expect(screen.getByText('pnpm test && rm -rf /tmp/out')).toBeInTheDocument();
    expect(screen.getByText('Product owner')).toBeInTheDocument();
    expect(screen.getByText('0 calls · 0 tokens remaining')).toBeInTheDocument();
    expect(
      screen.getByText('Loop is paused before more agent calls are allowed'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Raise cap or split scope, then continue the loop'),
    ).toBeInTheDocument();
    expect(screen.getByText('Action Queue')).toBeInTheDocument();
    expect(screen.getByText('Review Inbox')).toBeInTheDocument();
    expect(screen.getByText('1 human decision items')).toBeInTheDocument();
    expect(screen.getByText('Trace Summary')).toBeInTheDocument();
    expect(screen.getByText('Resume Summary')).toBeInTheDocument();
    expect(screen.getByText('Capability Registry')).toBeInTheDocument();
    expect(screen.getByText('A2A / Tool Registry')).toBeInTheDocument();
    expect(screen.getByText('Agent Registry')).toBeInTheDocument();
    expect(screen.getByText('Codex Planner / Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Tool Registry')).toBeInTheDocument();
    expect(screen.getAllByText('Repository Code Editor').length).toBeGreaterThan(0);
    expect(screen.getByText('Compatibility Checks')).toBeInTheDocument();
    expect(screen.getByText('phase-tool-ownership')).toBeInTheDocument();
    expect(screen.getByText('Permission Profile')).toBeInTheDocument();
    expect(screen.getByText('2 agents · 2 tools · 2 active tools')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('Write')).toBeInTheDocument();
    expect(screen.getByText('Shell/Test')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Approval')).toBeInTheDocument();
    expect(screen.getByText('2 third-party tool compatibilities planned')).toBeInTheDocument();
    expect(screen.getByText('SSO Asset Permissions')).toBeInTheDocument();
    expect(screen.getByText('1 granted · 2 blocked · source: SSO')).toBeInTheDocument();
    expect(screen.getByText('Delivery blueprints')).toBeInTheDocument();
    expect(screen.getByText('Recipe Admin')).toBeInTheDocument();
    expect(screen.getByText('Tenant scope')).toBeInTheDocument();
    expect(screen.getAllByText('Granted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('vibecoding:loops:create').length).toBeGreaterThan(0);
    expect(screen.getByText('Create version')).toBeInTheDocument();
    expect(screen.getByText('Review approval')).toBeInTheDocument();
    expect(screen.getByText('Rollback version')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Request/i })[0]!);
    expect(requestRecipeAdminActionMutate).toHaveBeenCalledWith({
      body: {
        actionId: 'createVersion',
        blueprintId: 'delivery-blueprints',
        reason: 'vibecoding:loops:create grants recipe version changes',
        evidenceRefs: [],
      },
    });
    expect(screen.getByText('Codex / Claude Code runtime backends')).toBeInTheDocument();
    expect(screen.getByText('MCP server registry')).toBeInTheDocument();
    expect(screen.getByText('Provider Profile')).toBeInTheDocument();
    expect(
      screen.getByText('2 providers · 2 active agents · 2 planned tool routes'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('1/1 active agents · 1 planned tools').length).toBeGreaterThan(0);
    expect(screen.getByText('Performance Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Pass rate')).toBeInTheDocument();
    expect(screen.getByText('Redo rate')).toBeInTheDocument();
    expect(screen.getByText('Avg calls')).toBeInTheDocument();
    expect(screen.getByText('Trace events')).toBeInTheDocument();
    const evalPlan = screen.getByRole('region', { name: 'Eval Plan' });
    expect(within(evalPlan).getByText('0/5 passed · 3 attention · 2 blocked')).toBeInTheDocument();
    expect(within(evalPlan).getAllByText('Architecture').length).toBeGreaterThan(0);
    expect(within(evalPlan).getByText('Runtime safety')).toBeInTheDocument();
    expect(
      within(evalPlan).getByText('1 runtime security exceptions recorded'),
    ).toBeInTheDocument();
    expect(within(evalPlan).getAllByText('Hard gate').length).toBeGreaterThan(0);
    const runtimeBackends = screen.getByRole('region', { name: 'Runtime Backends' });
    expect(
      within(runtimeBackends).getByText('1/2 ready · 1 degraded · 0 unavailable'),
    ).toBeInTheDocument();
    expect(within(runtimeBackends).getAllByText('Codex CLI').length).toBeGreaterThan(0);
    expect(within(runtimeBackends).getAllByText('Claude Code CLI').length).toBeGreaterThan(0);
    expect(screen.getByText('read/write/test within approved work package')).toBeInTheDocument();
    expect(screen.getByText('Fallback to deterministic review gate')).toBeInTheDocument();
    expect(screen.getByText('Feishu Integration')).toBeInTheDocument();
    expect(screen.getByText('Aging Queue')).toBeInTheDocument();
    expect(screen.getByText('Warning at 24h stale; critical at 72h stale.')).toBeInTheDocument();
    expect(screen.getAllByText(/73h stale/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fix checkout flow').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cost guard tripped').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Continue loop').length).toBeGreaterThan(0);
    const reviewInbox = screen.getByRole('region', { name: 'Review Inbox' });
    expect(within(reviewInbox).getAllByText('Review needed').length).toBeGreaterThan(0);
    expect(within(reviewInbox).getAllByText('Needs human input').length).toBeGreaterThan(0);
  });

  it('surfaces Docker image pull business failures without retrying detection', async () => {
    pullImageMutate.mockResolvedValueOnce({
      body: {
        data: {
          agent: 'claude-code',
          image: 'dofe-ai/sandbox:latest',
          status: 'failed',
          message: 'Docker image pull finished, but the image is not ready locally.',
        },
      },
    });

    renderWithIntl(<LoopsPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pull image' }));
      await Promise.resolve();
    });

    expect(retryAgentRuntime).not.toHaveBeenCalled();
    expect(
      screen.getByText('Docker image pull finished, but the image is not ready locally.'),
    ).toBeInTheDocument();
  });

  it('surfaces Docker image pull request errors without retrying detection', async () => {
    pullImageMutate.mockRejectedValueOnce(new Error('Docker pull request failed.'));

    renderWithIntl(<LoopsPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pull image' }));
      await Promise.resolve();
    });

    expect(retryAgentRuntime).not.toHaveBeenCalled();
    expect(screen.getByText('Docker pull request failed.')).toBeInTheDocument();
  });

  it('clears a previous Docker image pull error after a successful retry', async () => {
    pullImageMutate
      .mockRejectedValueOnce(new Error('Docker pull request failed.'))
      .mockResolvedValueOnce({
        body: {
          data: {
            agent: 'claude-code',
            image: 'dofe-ai/sandbox:latest',
            status: 'pulled',
            message: 'Pulled image.',
          },
        },
      });

    renderWithIntl(<LoopsPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pull image' }));
      await Promise.resolve();
    });
    expect(screen.getByText('Docker pull request failed.')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pull image' }));
      await Promise.resolve();
    });

    expect(screen.queryByText('Docker pull request failed.')).not.toBeInTheDocument();
    expect(retryAgentRuntime).toHaveBeenCalledTimes(1);
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

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      vi.setSystemTime(new Date('2026-06-23T01:00:00.000Z'));
      await act(async () => {
        root = hydrateRoot(
          container,
          <IntlWrapper>
            <LoopsPage />
          </IntlWrapper>,
        );
        await Promise.resolve();
        vi.runOnlyPendingTimers();
        await Promise.resolve();
      });
      await vi.waitFor(() => {
        expect(consoleError).not.toHaveBeenCalledWith(
          expect.stringContaining(
            "Hydration failed because the server rendered text didn't match the client",
          ),
          expect.anything(),
        );
      });
    } finally {
      if (root) {
        act(() => {
          root?.unmount();
        });
      }
      container.remove();
      console.error = originalError;
    }
  });
});
