'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Cpu,
  Inbox,
  GitBranch,
  GitPullRequest,
  KanbanSquare,
  Lightbulb,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import type {
  LoopAgentRuntimeResponse,
  LoopCapabilitiesResponse,
  LoopLogsResponse,
  LoopMetricsResponse,
  LoopNotificationsResponse,
} from '@repo/contracts';
import {
  useLoopsAgentRuntime,
  useLoopsCost,
  useLoopsCapabilities,
  useLoopsDoctor,
  useLoopsList,
  useLoopsLogs,
  useLoopsMetrics,
  useLoopsNotifications,
  useLoopsWorkspaces,
  useGovernLoopLearning,
  useGovernLoopDelivery,
  useRunLoopLearningAutoMergeWorker,
  usePullLoopsImage,
  useRetryLoopsAgentRuntime,
  useUpsertLoopsWorkspace,
  useResumeLoops,
} from '@/lib/api/contracts/hooks';
import {
  AGING_QUEUE_SLA_POLICY,
  aggregateLoops,
  buildAgingQueue,
  buildAgentHandoffTimeline,
  buildBlueprintMarketplace,
  buildDashboardGuide,
  buildFleetHealth,
  buildEvalPlan,
  buildExceptionCenter,
  buildLoopBench,
  buildLoopBoard,
  buildPermissionProfile,
  buildPerformanceSnapshot,
  buildProviderProfile,
  buildRecipeAdminSummary,
  buildRepoContextMap,
  buildReleaseGatePanel,
  buildReleaseReadiness,
  buildRulesCenter,
  buildRuntimeSecurityPanel,
  buildReviewGatePortfolio,
  buildReviewInbox,
  buildReviewInboxGroups,
  buildRiskQueue,
  buildRuntimeBackends,
  buildSecondOpinionConflictItems,
  buildToolRegistryLifecycle,
  buildTriggerLifecycle,
  buildTriggerPortfolio,
  buildWorkforceOverview,
  buildWorkflowRecipe,
  type EvalCheckStatus,
  type HandoffStepState,
  type RuntimeBackendStatus,
  type WorkforcePersona,
  type WorkforcePersonaStatus,
  formatPhase,
  type RiskLevel,
} from './loops-dashboard-model';
import { formatLoopEvent, formatLoopLabel, formatLoopStatus } from './loops-display';

function riskClass(level: RiskLevel) {
  if (level === 'critical') {
    return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100';
  }
  if (level === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-border bg-muted/40 text-foreground';
}

function actionClass(action: string) {
  if (action === 'resume' || action === 'review-spec' || action === 'reloop') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  if (action === 'finalize' || action === 'global-review') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  return 'border-border bg-muted/40 text-foreground';
}

function agentStatusClass(status: string) {
  if (status === 'running') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (status === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-border bg-muted/40 text-muted-foreground';
}

function runtimeBackendClass(status: RuntimeBackendStatus) {
  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (status === 'degraded') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100';
}

function evalStatusClass(status: EvalCheckStatus) {
  if (status === 'passed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (status === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100';
}

function workforcePersonaClass(status: WorkforcePersonaStatus) {
  if (status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (status === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100';
  }
  if (status === 'done') {
    return 'border-emerald-200 bg-emerald-50/50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/10 dark:text-emerald-100';
  }
  return 'border-border bg-muted/40 text-muted-foreground';
}

function handoffStepClass(state: HandoffStepState) {
  if (state === 'current') {
    return 'border-foreground bg-foreground text-background';
  }
  if (state === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100';
  }
  if (state === 'next') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  if (state === 'done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  return 'border-border bg-muted/30 text-muted-foreground';
}

const WORKFORCE_PERSONA_LABELS: Record<WorkforcePersona['id'], string> = {
  'intake-analyst': 'Intake Analyst',
  'spec-writer': 'Spec Writer',
  'human-gatekeeper': 'Human Gatekeeper',
  'work-planner': 'Work Planner',
  builder: 'Builder',
  'test-runner': 'Test Runner',
  'code-reviewer': 'Code Reviewer',
  'release-reviewer': 'Release Reviewer',
  'evidence-curator': 'Evidence Curator',
};

function workforceBackendLabel(backend: WorkforcePersona['runtimeBackend']) {
  if (backend === 'codex-cli') return 'Codex CLI';
  if (backend === 'claude-code-cli') return 'Claude Code CLI';
  if (backend === 'human') return 'Human';
  return 'System';
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

function MetricCard({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export default function LoopsPage() {
  const locale = useLocale();
  const t = useTranslations('loops.dashboard');
  const formatDashboardPhase = (phase: string) => {
    if (
      [
        'PHASE_0_INTAKE',
        'PHASE_1_SPEC',
        'PHASE_2_REVIEW',
        'PHASE_3_DECOMPOSE',
        'PHASE_4_IMPLEMENT',
        'PHASE_5_REVIEW',
        'PHASE_6_CONVERGE',
        'PHASE_7_GLOBAL_REVIEW',
        'PHASE_8_ANNOTATE',
        'CLOSED',
        'PAUSED',
      ].includes(phase)
    ) {
      return t(`phaseLabels.${phase}`);
    }
    return formatLoopLabel(formatPhase(phase), locale);
  };
  const formatRiskReason = (reason: string) => {
    if (reason === 'Paused' || reason === 'Cost guard tripped') {
      return t(`riskReasons.${reason}`);
    }
    return reason;
  };
  const [agingNow, setAgingNow] = useState<Date | null>(null);
  const listQuery = useLoopsList({ page: 1, limit: 20 });
  const doctorQuery = useLoopsDoctor();
  const costQuery = useLoopsCost();
  const agentRuntimeQuery = useLoopsAgentRuntime();
  const capabilitiesQuery = useLoopsCapabilities();
  const metricsQuery = useLoopsMetrics();
  const logsQuery = useLoopsLogs({ limit: 10 });
  const notificationsQuery = useLoopsNotifications({ limit: 8 });
  const resume = useResumeLoops();
  const workspacesQuery = useLoopsWorkspaces();
  const governLearning = useGovernLoopLearning();
  const autoMergeWorker = useRunLoopLearningAutoMergeWorker();
  const upsertWorkspace = useUpsertLoopsWorkspace();
  const pullImage = usePullLoopsImage();
  const retryDetection = useRetryLoopsAgentRuntime();

  const workspaces = workspacesQuery.data?.body?.data?.workspaces ?? [];
  const currentWorkspaceId = workspacesQuery.data?.body?.data?.current ?? '';
  const recentLearnings = workspacesQuery.data?.body?.data?.recentLearnings ?? [];

  const data = listQuery.data?.body.data;
  const doctor = doctorQuery.data?.body.data;
  const cost = costQuery.data?.body.data;
  const agentRuntime = agentRuntimeQuery.data?.body.data as LoopAgentRuntimeResponse | undefined;
  const runtimeDetection = agentRuntime?.runtimes ?? [];
  const capabilities = capabilitiesQuery.data?.body.data as LoopCapabilitiesResponse | undefined;
  const metrics = metricsQuery.data?.body.data as LoopMetricsResponse | undefined;
  const logs = logsQuery.data?.body.data as LoopLogsResponse | undefined;
  const notifications = notificationsQuery.data?.body.data as LoopNotificationsResponse | undefined;
  const currentWorkspace = workspaces.find((ws) => ws.workspaceId === currentWorkspaceId);
  const fallbackSummary = aggregateLoops(data, cost);
  const summary = metrics?.summary ?? fallbackSummary;
  const health = metrics?.health ?? doctor;
  const costSummary = metrics?.costSummary;
  const phaseDistribution =
    metrics?.phaseDistribution ??
    Object.entries(fallbackSummary.phaseCounts).map(([phase, count]) => ({
      phase,
      label: formatDashboardPhase(phase),
      count,
    }));
  const maxPhaseCount = Math.max(1, ...phaseDistribution.map((item) => item.count));
  const riskQueue =
    metrics?.riskQueue.map((risk) => ({
      id: `${risk.issueId}-${risk.reason}`,
      title: risk.title,
      href: risk.href,
      level: risk.level,
      reason: risk.reason,
      meta: risk.phase ? formatDashboardPhase(risk.phase) : risk.status,
    })) ?? buildRiskQueue(fallbackSummary.items, cost);
  const traceSummary = metrics?.traceSummary;
  const resumeSummary = metrics?.resumeSummary;
  const performanceSnapshot = buildPerformanceSnapshot(fallbackSummary.items, {
    cost,
    traceSummary,
  });
  const loopBench = buildLoopBench(fallbackSummary.items, { cost, agentRuntime, recentLearnings });
  const blueprintMarketplace = buildBlueprintMarketplace(fallbackSummary.items);
  const fleetHealth = buildFleetHealth(fallbackSummary.items, { cost, agentRuntime });
  const runtimeBackends = buildRuntimeBackends(agentRuntime);
  const evalPlan = buildEvalPlan(fallbackSummary.items, cost);
  const workforceOverview = buildWorkforceOverview(fallbackSummary.items, cost);
  const agingQueue = agingNow ? buildAgingQueue(fallbackSummary.items, agingNow) : [];
  const agentToolRegistry = capabilities?.capabilities.find(
    (capability) => capability.id === 'a2a-tool-registry',
  )?.agentToolRegistry;
  const permissionProfile = buildPermissionProfile(agentToolRegistry);
  const providerProfile = buildProviderProfile(agentToolRegistry, agentRuntime);
  const actionQueue = metrics?.actionQueue ?? [];
  const secondOpinionConflicts = buildSecondOpinionConflictItems(fallbackSummary.items);
  const reviewInbox = [
    ...buildReviewInbox(actionQueue, notifications?.notifications, locale),
    ...secondOpinionConflicts,
  ];
  const reviewInboxGroups = buildReviewInboxGroups(reviewInbox);
  const loopBoard = buildLoopBoard(fallbackSummary.items, cost);
  const workflowRecipe = buildWorkflowRecipe(fallbackSummary.items, cost);
  const reviewGatePortfolio = buildReviewGatePortfolio(fallbackSummary.items, cost);
  const releaseReadiness = buildReleaseReadiness(fallbackSummary.items, cost);
  const releaseGatePanel = buildReleaseGatePanel(fallbackSummary.items, { cost });
  const runtimeSecurityPanel = buildRuntimeSecurityPanel(fallbackSummary.items, { agentRuntime });
  const rulesCenter = buildRulesCenter(fallbackSummary.items, { agentRuntime });
  const topLearnings = [...recentLearnings]
    .sort((a, b) => b.confidence - a.confidence || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const staleLearnings = recentLearnings.filter((learning) => !learning.lastUsedAt).slice(0, 3);
  const learningById = new Map(recentLearnings.map((learning) => [learning.id, learning]));
  const triggerPortfolio = buildTriggerPortfolio(fallbackSummary.items);
  const triggerLifecycle = buildTriggerLifecycle(fallbackSummary.items);
  const toolRegistryLifecycle = buildToolRegistryLifecycle(agentToolRegistry);
  const recipeAdmin = buildRecipeAdminSummary(fallbackSummary.items, cost);
  const repoContextMap = buildRepoContextMap(fallbackSummary.items, cost);
  const exceptionCenter = buildExceptionCenter(fallbackSummary.items, {
    cost,
    runtime: agentRuntime,
    health: health
      ? {
          fileProblems: [],
          dbProblems: [],
          consistencyProblems: health.problems,
          ...health,
        }
      : undefined,
  });
  const dashboardGuide = buildDashboardGuide({
    totalIssues: summary.total,
    reviewItems: reviewInbox.length,
    exceptionItems: exceptionCenter.items.length,
    deliveredItems: loopBoard.find((column) => column.id === 'delivered')?.items.length ?? 0,
  });
  // Distinct error state: previously a failed list/doctor query rendered as
  // perpetual "loading". Surface it as an explicit banner instead.
  const dataLoadFailed = listQuery.isError || doctorQuery.isError;

  useEffect(() => {
    const timer = window.setTimeout(() => setAgingNow(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('eyebrow')}</p>
            <h1 className="text-3xl font-semibold tracking-normal">{t('title')}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted/30 disabled:opacity-60"
              disabled={resume.isPending}
              onClick={() => resume.mutate({ body: {} })}
              type="button"
            >
              <RefreshCw className="size-4" />
              {resume.isPending ? t('resuming') : t('resume')}
            </button>
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background"
              href="/loops/new"
            >
              <Plus className="size-4" />
              {t('newIssue')}
            </Link>
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('workspace.title')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
                disabled={workspacesQuery.isLoading || upsertWorkspace.isPending}
                onChange={(event) => {
                  const next = workspaces.find((ws) => ws.workspaceId === event.target.value);
                  if (next) {
                    upsertWorkspace.mutateAsync({
                      body: { workspaceId: next.workspaceId, root: next.root, makeDefault: true },
                    });
                  }
                }}
                value={currentWorkspaceId}
              >
                {workspacesQuery.isLoading ? (
                  <option value="">{t('workspace.loading')}</option>
                ) : (
                  workspaces.map((ws) => (
                    <option key={ws.workspaceId} value={ws.workspaceId}>
                      {ws.workspaceId === currentWorkspaceId
                        ? t('workspace.current', { id: ws.workspaceId })
                        : ws.workspaceId}
                    </option>
                  ))
                )}
              </select>
              <span className="text-xs text-muted-foreground">
                {t('workspace.runtimeSummary', {
                  codex:
                    runtimeDetection.find((r) => r.agent === 'codex')?.preferredMode ?? 'local-cli',
                  claude:
                    runtimeDetection.find((r) => r.agent === 'claude-code')?.preferredMode ??
                    'local-cli',
                })}
              </span>
            </div>
          </div>
          {currentWorkspace?.rules ? (
            <div className="min-w-0 rounded-md border bg-muted/20 p-3 text-xs sm:max-w-xl">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{t('workspace.rules.title')}</span>
                <span className="shrink-0 rounded-md border bg-background px-2 py-0.5">
                  {t('workspace.rules.summary', {
                    present: currentWorkspace.rules.present,
                    total: currentWorkspace.rules.total,
                  })}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {currentWorkspace.rules.rules.map((rule) => (
                  <span
                    className={`rounded-md border px-2 py-1 ${
                      rule.status === 'present'
                        ? 'bg-background text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    key={rule.id}
                    title={rule.summary ?? rule.path}
                  >
                    {rule.label} · {t(`workspace.rules.status.${rule.status}`)}
                  </span>
                ))}
              </div>
              {currentWorkspace.rules.diagnostics?.length ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  {currentWorkspace.rules.diagnostics.slice(0, 3).map((diagnostic) => (
                    <div
                      className={`rounded-md border px-2 py-1.5 ${
                        diagnostic.level === 'warning'
                          ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                          : 'bg-background text-muted-foreground'
                      }`}
                      key={diagnostic.id}
                    >
                      <p className="font-medium">{diagnostic.message}</p>
                      <p className="mt-0.5 truncate opacity-80">{diagnostic.evidence}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {dataLoadFailed ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {t('loadError')}
          </div>
        ) : null}

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">{t('guide.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('guide.summary')}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            {dashboardGuide.map((step) => (
              <Link
                className={`rounded-md border p-3 text-sm transition hover:bg-muted/30 ${
                  step.state === 'active'
                    ? 'border-foreground bg-muted/30'
                    : step.state === 'done'
                      ? 'bg-muted/20'
                      : 'text-muted-foreground'
                }`}
                href={step.href}
                key={step.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t(`guide.steps.${step.id}.title`)}</span>
                  <span className="rounded-md border bg-background px-2 py-0.5 text-xs">
                    {t(`guide.state.${step.state}`)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {t(`guide.steps.${step.id}.body`)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={<Activity className="size-4" />}
            label={t('metrics.active')}
            note={t('metrics.activeNote', { total: summary.total })}
            value={summary.active}
          />
          <MetricCard
            icon={<Play className="size-4" />}
            label={t('metrics.inLoop')}
            note={t('metrics.inLoopNote')}
            value={summary.inLoop}
          />
          <MetricCard
            icon={<AlertTriangle className="size-4" />}
            label={t('metrics.needsAttention')}
            note={t('metrics.attentionNote', {
              paused: summary.paused,
              guards: costSummary?.tripped ?? fallbackSummary.costTripped.length,
            })}
            value={summary.attention}
          />
          <MetricCard
            icon={<CircleDollarSign className="size-4" />}
            label={t('metrics.runway')}
            note={t('metrics.runwayNote', {
              tokens: costSummary?.minTokensRemaining ?? fallbackSummary.minTokensRemaining,
            })}
            value={t('metrics.runwayValue', {
              calls: costSummary?.minCallsRemaining ?? fallbackSummary.minCallsRemaining,
            })}
          />
          <MetricCard
            icon={<CheckCircle2 className="size-4" />}
            label={t('metrics.closed')}
            note={t('metrics.closedNote')}
            value={summary.closed}
          />
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('fleetHealth.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('fleetHealth.summary')}</p>
            </div>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">{t('fleetHealth.active')}</p>
              <p className="mt-1 text-lg font-semibold">{fleetHealth.summary.activeLoops}</p>
            </div>
            <div
              className={`rounded-md border p-3 text-xs ${fleetHealth.summary.blockedLoops > 0 ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100' : 'bg-muted/20'}`}
            >
              <p className="text-muted-foreground">{t('fleetHealth.blocked')}</p>
              <p className="mt-1 text-lg font-semibold">{fleetHealth.summary.blockedLoops}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">{t('fleetHealth.costTripped')}</p>
              <p className="mt-1 text-lg font-semibold">{fleetHealth.summary.costTripped}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">{t('fleetHealth.humanGates')}</p>
              <p className="mt-1 text-lg font-semibold">{fleetHealth.summary.humanGatesWaiting}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">{t('fleetHealth.runtimeReady')}</p>
              <p className="mt-1 text-lg font-semibold">
                {fleetHealth.summary.runtimeReady}/
                {fleetHealth.summary.runtimeReady + fleetHealth.summary.runtimeDegraded}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">{t('fleetHealth.releaseReady')}</p>
              <p className="mt-1 text-lg font-semibold">{fleetHealth.summary.releaseReady}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">{t('fleetHealth.repos')}</p>
              <p className="mt-1 text-lg font-semibold">{fleetHealth.repoBreakdown.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('rulesCenter.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('rulesCenter.summary', rulesCenter.summary)}
              </p>
            </div>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
            {rulesCenter.rules.map((rule) => (
              <div
                className={`rounded-md border p-2 text-xs ${
                  rule.enforced
                    ? rule.violations > 0
                      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                    : 'border-border bg-muted/20 text-muted-foreground'
                }`}
                key={rule.id}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">
                    {t(`rulesCenter.rules.${rule.id}`, { defaultValue: rule.label })}
                  </span>
                  <span className="shrink-0 rounded-md border bg-background/70 px-1.5 py-0.5">
                    {t(`rulesCenter.categories.${rule.category}`, {
                      defaultValue: rule.category,
                    })}
                  </span>
                </div>
                <p className="mt-1 truncate opacity-80">{rule.evidence}</p>
                <p className="mt-1 truncate text-right font-medium">
                  {rule.enforced ? t('rulesCenter.enforced') : t('rulesCenter.attention')}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">{t('performance.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('performance.summary')}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              icon={<CheckCircle2 className="size-4" />}
              label={t('performance.passRate')}
              note={t('performance.passRateNote')}
              value={`${performanceSnapshot.passRate}%`}
            />
            <MetricCard
              icon={<RefreshCw className="size-4" />}
              label={t('performance.redoRate')}
              note={t('performance.redoRateNote')}
              value={`${performanceSnapshot.redoRate}%`}
            />
            <MetricCard
              icon={<CircleDollarSign className="size-4" />}
              label={t('performance.averageCalls')}
              note={t('performance.averageCallsNote')}
              value={performanceSnapshot.averageCalls}
            />
            <MetricCard
              icon={<Activity className="size-4" />}
              label={t('performance.averageTokens')}
              note={t('performance.averageTokensNote')}
              value={performanceSnapshot.averageTokens}
            />
            <MetricCard
              icon={<GitBranch className="size-4" />}
              label={t('performance.traceEvents')}
              note={t('performance.traceEventsNote', {
                recent: performanceSnapshot.recentEvents,
              })}
              value={performanceSnapshot.traceEvents}
            />
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('loopBench.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('loopBench.summary')}</p>
            </div>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t('loopBench.firstPassRate')}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 ${
                    loopBench.firstPassReviewRate >= 70
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                  }`}
                >
                  {loopBench.firstPassReviewRate}%
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{t('loopBench.firstPassRateDesc')}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t('loopBench.browserQaRegression')}</span>
                <span className="shrink-0 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {loopBench.browserQaRegressionRate}%
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{t('loopBench.browserQaRegressionDesc')}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t('loopBench.secondOpinionConflict')}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 ${
                    loopBench.secondOpinionConflictRate <= 10
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                  }`}
                >
                  {loopBench.secondOpinionConflictRate}%
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {t('loopBench.secondOpinionConflictDesc')}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t('loopBench.releaseBlocker')}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 ${
                    loopBench.releaseBlockerRate <= 20
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : loopBench.releaseBlockerRate <= 50
                        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                        : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100'
                  }`}
                >
                  {loopBench.releaseBlockerRate}%
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{t('loopBench.releaseBlockerDesc')}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t('loopBench.runtimeViolation')}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 ${
                    loopBench.runtimeViolationRate <= 5
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                  }`}
                >
                  {loopBench.runtimeViolationRate}%
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{t('loopBench.runtimeViolationDesc')}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t('loopBench.learningReuse')}</span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 ${
                    loopBench.learningReuseRate > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {loopBench.learningReuseRate > 0
                    ? `${loopBench.learningReuseRate}%`
                    : t('loopBench.planned')}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{t('loopBench.learningReuseDesc')}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('workforce.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('workforce.summary', workforceOverview.summary)}
              </p>
            </div>
            <Users className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('workforce.loading')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {workforceOverview.personas.map((persona) => (
                <Link
                  className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${workforcePersonaClass(
                    persona.status,
                  )}`}
                  href={
                    persona.activeIssueIds[0] ? `/loops/${persona.activeIssueIds[0]}` : '/loops'
                  }
                  key={persona.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate font-medium">
                      {WORKFORCE_PERSONA_LABELS[persona.id]}
                    </span>
                    <span className="shrink-0 rounded-md border bg-background/70 px-2 py-0.5 text-xs">
                      {t(`workforce.status.${persona.status}`)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs opacity-80">
                    {workforceBackendLabel(persona.runtimeBackend)}
                    {persona.humanGate ? ` · ${t('workforce.humanGate')}` : ''}
                  </p>
                  <p className="mt-1 truncate text-xs opacity-80">
                    {persona.count > 0
                      ? t('workforce.personaCount', { count: persona.count })
                      : t('workforce.idle')}
                  </p>
                  {persona.activeIssueIds.length > 0 ? (
                    <p className="mt-1 truncate text-xs font-medium">
                      {persona.activeIssueIds.slice(0, 2).join(', ')}
                      {persona.activeIssueIds.length > 2
                        ? ` +${persona.activeIssueIds.length - 2}`
                        : ''}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('evalPlan.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('evalPlan.summary', evalPlan.summary)}
              </p>
            </div>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('evalPlan.loading')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {evalPlan.checks.map((check) => (
                <div
                  className={`rounded-md border p-3 text-xs ${evalStatusClass(check.status)}`}
                  key={check.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(`evalPlan.checks.${check.id}`)}</span>
                    <span className="shrink-0 rounded-md border bg-background/70 px-2 py-0.5">
                      {t(`evalPlan.status.${check.status}`)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 opacity-80">{check.evidence}</p>
                  <p className="mt-2 truncate font-medium">
                    {check.hardGate ? t('evalPlan.hardGate') : t('evalPlan.softSignal')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('health.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {health
                    ? health.ok
                      ? t('health.ok')
                      : t('health.attention')
                    : t('health.loading')}
                </p>
              </div>
              <span className="rounded-md border px-2 py-1 text-xs font-medium">
                {health
                  ? health.ok
                    ? t('health.okBadge')
                    : t('health.attentionBadge')
                  : t('health.loadingBadge')}
              </span>
            </div>
            {health ? (
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">{t('health.loops')}</p>
                  <p className="mt-1 text-lg font-semibold">{health.loops}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">{t('health.issues')}</p>
                  <p className="mt-1 text-lg font-semibold">{health.issues}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">{t('health.problems')}</p>
                  <p className="mt-1 text-lg font-semibold">{health.problems.length}</p>
                </div>
              </div>
            ) : null}
            {health?.problems.length ? (
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {health.problems.slice(0, 4).map((problem) => (
                  <li className="break-all rounded-md border px-3 py-2" key={problem}>
                    {problem}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold">{t('riskQueue.title')}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {!data ? (
                <EmptyLine>{t('riskQueue.loading')}</EmptyLine>
              ) : riskQueue.length === 0 ? (
                <EmptyLine>{t('riskQueue.empty')}</EmptyLine>
              ) : (
                riskQueue.map((risk) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(risk.level)}`}
                    href={risk.href}
                    key={risk.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{risk.title}</span>
                      <span className="shrink-0 text-xs">{formatRiskReason(risk.reason)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">{risk.meta}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('triggerPortfolio.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('triggerPortfolio.summary', {
                  total: triggerPortfolio.summary.total,
                  sources: triggerPortfolio.summary.sources,
                  repos: triggerPortfolio.summary.repos,
                })}
              </p>
            </div>
            <Workflow className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('triggerPortfolio.loading')}</EmptyLine>
          ) : triggerPortfolio.summary.total === 0 ? (
            <EmptyLine>{t('triggerPortfolio.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
              <div className="rounded-md border bg-muted/20 p-3">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('triggerPortfolio.sources')}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {triggerLifecycle.sources.map((source) => (
                    <div
                      className={`flex items-center justify-between gap-3 rounded-md p-2 text-xs ${
                        source.status === 'active'
                          ? 'border border-emerald-200 bg-background text-emerald-950 dark:border-emerald-900/70 dark:text-emerald-100'
                          : source.status === 'error'
                            ? 'border border-red-200 bg-background text-red-950 dark:border-red-900/70 dark:text-red-100'
                            : 'bg-background'
                      }`}
                      key={source.id}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="truncate font-medium">{source.id}</span>
                        <p className="mt-0.5 truncate opacity-70">
                          {t('triggerLifecycle.sourceCount', {
                            count: source.count,
                            repos: source.repos.length,
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${
                          source.status === 'active'
                            ? 'bg-background/70'
                            : source.status === 'error'
                              ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100'
                              : 'bg-background/70'
                        }`}
                      >
                        {t(`triggerLifecycle.${source.status}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {triggerPortfolio.recent.map((item) => (
                  <Link
                    className="rounded-md border p-3 text-sm transition hover:bg-muted/30"
                    href={item.href}
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-2 font-medium">{item.title}</span>
                      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs">
                        {item.source}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{item.repo}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t('triggerPortfolio.submittedBy', {
                        user: item.submittedBy,
                        time: item.created,
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('repoContext.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('repoContext.summary', {
                  repos: repoContextMap.summary.repos,
                  issues: repoContextMap.summary.issues,
                  blocked: repoContextMap.summary.blocked,
                })}
              </p>
            </div>
            <GitBranch className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('repoContext.loading')}</EmptyLine>
          ) : repoContextMap.repos.length === 0 ? (
            <EmptyLine>{t('repoContext.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {repoContextMap.repos.slice(0, 6).map((repo) => (
                <div className="rounded-md border bg-muted/20 p-3 text-sm" key={repo.repo}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{repo.repo}</span>
                    <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs">
                      {t('repoContext.issueCount', { count: repo.issues })}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-background/70 px-2 py-1.5">
                      <p className="text-muted-foreground">{t('repoContext.blocked')}</p>
                      <p className="font-medium">{repo.blocked}</p>
                    </div>
                    <div className="rounded-md bg-background/70 px-2 py-1.5">
                      <p className="text-muted-foreground">{t('repoContext.latest')}</p>
                      <p className="truncate font-medium">{repo.latest}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {repo.phases.map((phase) => (
                      <span
                        className="rounded-md bg-background px-2 py-1 text-xs"
                        key={phase.phase}
                      >
                        {phase.phase} · {phase.count}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {repo.recent.map((item) => (
                      <Link
                        className="rounded-md border bg-background p-2 text-xs transition hover:bg-muted/30"
                        href={item.href}
                        key={item.id}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{item.title}</span>
                          <span className="shrink-0 text-muted-foreground">{item.status}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{item.phase}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('loopBoard.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('loopBoard.summary', { count: fallbackSummary.items.length })}
              </p>
            </div>
            <KanbanSquare className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('loopBoard.loading')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
              {loopBoard.map((column) => (
                <div className="min-w-0 rounded-md border bg-muted/20 p-3" key={column.id}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-xs font-semibold">
                      {t(`loopBoard.columns.${column.id}`)}
                    </h3>
                    <span className="rounded-md border bg-background px-2 py-0.5 text-xs">
                      {column.items.length}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {column.items.length === 0 ? (
                      <p className="py-3 text-xs text-muted-foreground">{t('loopBoard.empty')}</p>
                    ) : (
                      column.items.slice(0, 4).map((item) => (
                        <Link
                          className="rounded-md border bg-background p-3 text-xs transition hover:bg-muted/30"
                          href={item.href}
                          key={item.id}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 font-medium">{item.title}</span>
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5">
                              {item.priority}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                            <span className="rounded-md bg-muted px-1.5 py-0.5">{item.mode}</span>
                            <span className="rounded-md bg-muted px-1.5 py-0.5">
                              {item.humanGate}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-muted-foreground">{item.evidence}</p>
                          <p className="mt-1 truncate text-muted-foreground">{item.gitRef}</p>
                          <p className="mt-1 truncate text-muted-foreground">{item.prState}</p>
                          {item.blocker ? (
                            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
                              {item.blocker}
                            </p>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('workflowRecipe.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('workflowRecipe.summary', {
                  total: workflowRecipe.summary.total,
                  blocked: workflowRecipe.summary.blocked,
                  releaseReady: workflowRecipe.summary.releaseReady,
                })}
              </p>
            </div>
            <Workflow className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('workflowRecipe.loading')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-7">
              {workflowRecipe.steps.map((step) => (
                <div
                  className={`rounded-md border p-3 text-xs ${
                    step.state === 'blocked'
                      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                      : step.state === 'current'
                        ? 'border-foreground bg-muted/30'
                        : step.state === 'done'
                          ? 'bg-muted/20'
                          : 'text-muted-foreground'
                  }`}
                  key={step.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(`workflowRecipe.steps.${step.id}`)}</span>
                    <span className="rounded-md border bg-background px-2 py-0.5">
                      {t(`workflowRecipe.state.${step.state}`)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-muted-foreground">
                    {t(`workflowRecipe.gate.${step.gate}`)}
                  </p>
                  <p className="mt-1 truncate font-medium">{step.evidence}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('recipeAdmin.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('recipeAdmin.summary', {
                  kinds: recipeAdmin.summary.totalKinds,
                  loops: recipeAdmin.summary.totalLoops,
                  blocked: recipeAdmin.summary.totalBlocked,
                })}
              </p>
            </div>
            <Workflow className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('recipeAdmin.loading')}</EmptyLine>
          ) : recipeAdmin.items.length === 0 ? (
            <EmptyLine>{t('recipeAdmin.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {recipeAdmin.items.map((item) => (
                <div className="rounded-md border bg-muted/20 p-3 text-xs" key={item.loopKind}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {t(`recipeAdmin.kind.${item.loopKind}`, { defaultValue: item.loopKind })}
                    </span>
                    <span className="shrink-0 rounded-md bg-background px-2 py-0.5">
                      {item.count}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>{t('recipeAdmin.blockerRate')}</span>
                      <span
                        className={
                          item.blockerRate > 50
                            ? 'text-red-600 font-medium'
                            : item.blockerRate > 25
                              ? 'text-amber-600 font-medium'
                              : 'font-medium'
                        }
                      >
                        {item.blockerRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t('recipeAdmin.avgShards')}</span>
                      <span className="font-medium">
                        {item.avgShardsDone}/{item.avgShardsTotal}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('blueprintMarketplace.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('blueprintMarketplace.summary', blueprintMarketplace.summary)}
              </p>
            </div>
            <Lightbulb className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            {blueprintMarketplace.blueprints.map((bp) => (
              <Link
                className="rounded-md border p-3 text-xs transition hover:bg-muted/30"
                href={`/loops/new?template=${bp.id}`}
                key={bp.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{bp.label}</span>
                  <span className="shrink-0 rounded-md border bg-background px-1.5 py-0.5">
                    {bp.defaultPriority}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-muted-foreground">{bp.description}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-muted-foreground">
                  <span>{bp.personaCount} personas</span>
                  <span>· {bp.evalCount} evals</span>
                  <span>· {bp.gateCount} gates</span>
                  {bp.humanGateCount > 0 ? <span>· {bp.humanGateCount} human</span> : null}
                </div>
                <p className="mt-1 text-muted-foreground">{bp.primaryRuntime}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('reviewGates.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('reviewGates.summary', reviewGatePortfolio.summary)}
              </p>
            </div>
            <ListChecks className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('reviewGates.loading')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              {reviewGatePortfolio.gates.map((gate) => (
                <div
                  className={`rounded-md border p-3 text-xs ${
                    gate.status === 'blocked' || gate.status === 'needsChanges'
                      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                      : gate.status === 'passed'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                        : 'bg-muted/20 text-muted-foreground'
                  }`}
                  key={gate.kind}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(`reviewGates.kind.${gate.kind}`)}</span>
                    <span className="rounded-md border bg-background px-2 py-0.5">
                      {t(`reviewGates.status.${gate.status}`)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-muted-foreground">{gate.evidence}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('releaseGatePanel.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('releaseGatePanel.summary', releaseGatePanel.summary)}
              </p>
            </div>
            <GitPullRequest className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('releaseGatePanel.loading')}</EmptyLine>
          ) : releaseGatePanel.summary.totalWithGate === 0 ? (
            <EmptyLine>{t('releaseGatePanel.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                {releaseGatePanel.checklist.slice(0, 10).map((item) => (
                  <div
                    className={`rounded-md border p-2 text-xs ${
                      item.rate >= 80
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                        : item.rate >= 50
                          ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                          : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100'
                    }`}
                    key={item.key}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-medium">
                        {t(`releaseGatePanel.checklist.${item.key}`)}
                      </span>
                      <span className="shrink-0 rounded-md border bg-background/70 px-1.5 py-0.5">
                        {item.rate}%
                      </span>
                    </div>
                    <p className="mt-1 truncate opacity-80">
                      {item.passed}/{item.total} passed
                      {item.blocked > 0 ? ` · ${item.blocked} blocked` : ''}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('releaseGatePanel.topBlockers')}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {releaseGatePanel.topBlockers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('releaseGatePanel.noBlockers')}
                    </p>
                  ) : (
                    releaseGatePanel.topBlockers.map((blocker) => (
                      <Link
                        className="rounded-md border bg-background p-2 text-xs transition hover:bg-muted/30"
                        href={blocker.href}
                        key={blocker.issueId}
                      >
                        <span className="line-clamp-2 font-medium">{blocker.title}</span>
                        <p className="mt-1 truncate text-muted-foreground">
                          {t(
                            `releaseGatePanel.blockerReasons.${blocker.reason.replace(/ /g, '_')}`,
                            {
                              defaultValue: blocker.reason,
                            },
                          )}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('releaseReadiness.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('releaseReadiness.summary', releaseReadiness.summary)}
              </p>
            </div>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('releaseReadiness.loading')}</EmptyLine>
          ) : releaseReadiness.items.length === 0 ? (
            <EmptyLine>{t('releaseReadiness.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {releaseReadiness.items.map((item) => (
                <Link
                  className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${
                    item.state === 'blocked'
                      ? riskClass('critical')
                      : item.state === 'attention'
                        ? riskClass('warning')
                        : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                  }`}
                  href={item.href}
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 font-medium">{item.title}</span>
                    <span className="shrink-0 rounded-md bg-background/70 px-2 py-1 text-xs">
                      {t(`releaseReadiness.state.${item.state}`)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs opacity-80">{item.evidence}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {(['spec', 'implementation', 'review', 'qa'] as const).map((key) => (
                      <span
                        className={`rounded-md border bg-background/60 px-2 py-1 ${
                          item.checklist[key] ? 'font-medium' : 'opacity-60'
                        }`}
                        key={key}
                      >
                        {t(`releaseReadiness.checklist.${key}`)}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('exceptionCenter.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('exceptionCenter.summary', {
                  running: exceptionCenter.capacity.running,
                  queued: exceptionCenter.capacity.queued,
                  failed: exceptionCenter.capacity.failed,
                  capacity: exceptionCenter.capacity.capacity,
                })}
              </p>
            </div>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('exceptionCenter.loading')}</EmptyLine>
          ) : exceptionCenter.items.length === 0 ? (
            <EmptyLine>{t('exceptionCenter.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {exceptionCenter.items.map((item) => (
                <Link
                  className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(item.level)}`}
                  href={item.href}
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-1 truncate text-xs opacity-80">{item.reason}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-background/70 px-2 py-1 text-xs">
                      {item.source}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0 rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('exceptionCenter.owner')}</p>
                      <p className="truncate font-medium">{item.owner}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('exceptionCenter.action')}</p>
                      <p className="truncate font-medium">{item.action}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('exceptionCenter.evidence')}</p>
                      <p className="truncate font-medium">{item.evidence}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('exceptionCenter.impact')}</p>
                      <p className="truncate font-medium">{item.impact}</p>
                    </div>
                    <div className="min-w-0 rounded-md bg-background/60 px-2 py-1.5 sm:col-span-2 xl:col-span-4">
                      <p className="opacity-70">{t('exceptionCenter.retryAction')}</p>
                      <p className="truncate font-medium">{item.retryAction}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('runtimeBackends.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('runtimeBackends.summary', runtimeBackends.summary)}
              </p>
            </div>
            <Cpu className="size-4 text-muted-foreground" />
          </div>
          {!agentRuntime ? (
            <EmptyLine>{t('runtimeBackends.loading')}</EmptyLine>
          ) : runtimeBackends.items.length === 0 ? (
            <EmptyLine>{t('runtimeBackends.empty')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {runtimeBackends.items.map((backend) => (
                <div
                  className={`rounded-md border p-3 text-sm ${runtimeBackendClass(backend.status)}`}
                  key={backend.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{backend.name}</p>
                      <p className="mt-1 truncate text-xs opacity-80">
                        {backend.kind} · {backend.mode}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border bg-background/70 px-2 py-1 text-xs">
                      {t(`runtimeBackends.status.${backend.status}`)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('runtimeBackends.permissions')}</p>
                      <p className="line-clamp-2 font-medium">{backend.permissionProfile}</p>
                    </div>
                    <div className="rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('runtimeBackends.workspace')}</p>
                      <p className="line-clamp-2 font-medium">{backend.workspacePolicy}</p>
                    </div>
                    <div className="rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('runtimeBackends.cost')}</p>
                      <p className="line-clamp-2 font-medium">{backend.costPolicy}</p>
                    </div>
                    <div className="rounded-md bg-background/60 px-2 py-1.5">
                      <p className="opacity-70">{t('runtimeBackends.fallback')}</p>
                      <p className="line-clamp-2 font-medium">{backend.fallbackPolicy}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {backend.supportedStages.map((stage) => (
                      <span className="rounded-md border bg-background/60 px-2 py-1" key={stage}>
                        {stage}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 truncate text-xs opacity-80">
                    {backend.healthChecks.length
                      ? backend.healthChecks[0]
                      : t('runtimeBackends.readyEvidence', { evidence: backend.evidence })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('agentRuntime.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('agentRuntime.summary', {
                  running: agentRuntime?.summary.running ?? 0,
                  attention: agentRuntime?.summary.attention ?? 0,
                  total: agentRuntime?.summary.total ?? 0,
                })}
              </p>
            </div>
            <Cpu className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
            {!agentRuntime ? (
              <EmptyLine>{t('agentRuntime.loading')}</EmptyLine>
            ) : (
              agentRuntime.agents.map((agent) => {
                const content = (
                  <div
                    className={`h-full rounded-md border p-3 text-sm transition ${agentStatusClass(agent.status)} ${agent.href ? 'hover:opacity-80' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-medium">{agent.label}</span>
                      <span className="shrink-0 rounded-md bg-background/70 px-2 py-1 text-xs">
                        {t(`agentRuntime.status.${agent.status}`)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs opacity-80">{agent.meta}</p>
                    <p className="mt-2 line-clamp-2 text-xs">
                      {agent.issueTitle ?? t('agentRuntime.noActiveIssue')}
                    </p>
                    {agent.diagnostics.length ? (
                      <p className="mt-2 line-clamp-2 text-xs font-medium">
                        {agent.diagnostics[0]}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate opacity-80">
                        {agent.updated
                          ? t('agentRuntime.updated', { time: agent.updated })
                          : t('agentRuntime.noUpdate')}
                      </span>
                      {agent.href ? (
                        <span className="shrink-0 font-medium">{t('agentRuntime.openIssue')}</span>
                      ) : null}
                    </div>
                  </div>
                );

                return agent.href ? (
                  <Link href={agent.href} key={agent.id}>
                    {content}
                  </Link>
                ) : (
                  <div key={agent.id}>{content}</div>
                );
              })
            )}
          </div>
          <div className="mt-4 border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground">
              {t('agentRuntime.diagnostics')}
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {!agentRuntime ? (
                <EmptyLine>{t('agentRuntime.loadingDiagnostics')}</EmptyLine>
              ) : agentRuntime.diagnostics.length === 0 ? (
                <EmptyLine>{t('agentRuntime.noDiagnostics')}</EmptyLine>
              ) : (
                agentRuntime.diagnostics.slice(0, 6).map((diagnostic) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(diagnostic.level)}`}
                    href={diagnostic.href}
                    key={diagnostic.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{diagnostic.title}</span>
                      <span className="shrink-0 text-xs">{diagnostic.reason}</span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">{diagnostic.meta}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
                      <span className="min-w-0 truncate">
                        {diagnostic.updated
                          ? t('agentRuntime.updated', { time: diagnostic.updated })
                          : t('agentRuntime.noUpdate')}
                      </span>
                      <span className="shrink-0 font-medium">{t('agentRuntime.openIssue')}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* 0622 · B6: environment-derived runtime detection (local CLI + Docker)
              with per-check action buttons. */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground">
                {t('agentRuntime.detection.title')}
              </h3>
              <button
                className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted/30 disabled:opacity-60"
                disabled={!agentRuntime}
                onClick={() => retryDetection()}
                type="button"
              >
                <RefreshCw className="size-3" />
                {t('agentRuntime.detection.retry')}
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {!agentRuntime ? (
                <EmptyLine>{t('agentRuntime.detection.loading')}</EmptyLine>
              ) : runtimeDetection.length === 0 ? (
                <EmptyLine>{t('agentRuntime.detection.empty')}</EmptyLine>
              ) : (
                runtimeDetection.map((runtime) => {
                  const modeLabel = t(
                    `agentRuntime.detection.mode.${runtime.selected?.mode ?? runtime.preferredMode}`,
                  );
                  return (
                    <div className="rounded-md border p-3 text-sm" key={runtime.agent}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">
                          {t(`agentRuntime.detection.agent.${runtime.agent}`)}
                        </span>
                        <span className="shrink-0 rounded-md bg-muted/40 px-2 py-1 text-xs">
                          {modeLabel}
                        </span>
                      </div>
                      {runtime.checks.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-2">
                          {runtime.checks.map((check) => (
                            <li
                              className={`rounded-md border p-2 text-xs ${riskClass(check.level)}`}
                              key={check.code}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>{check.message}</span>
                                {check.action === 'pull-image' ? (
                                  <button
                                    className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted/30 disabled:opacity-60"
                                    disabled={pullImage.isPending}
                                    onClick={() =>
                                      pullImage.mutateAsync({
                                        params: { workspaceId: currentWorkspaceId },
                                        body: { agent: runtime.agent },
                                      })
                                    }
                                    type="button"
                                  >
                                    {t('agentRuntime.detection.actions.pull-image')}
                                  </button>
                                ) : check.action === 'use-docker' ? (
                                  <button
                                    className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted/30 disabled:opacity-60"
                                    disabled={upsertWorkspace.isPending}
                                    onClick={() => {
                                      const ws = workspaces.find(
                                        (item) => item.workspaceId === currentWorkspaceId,
                                      );
                                      if (!ws) return;
                                      upsertWorkspace.mutateAsync({
                                        body: {
                                          workspaceId: ws.workspaceId,
                                          root: ws.root,
                                          makeDefault: true,
                                          agents: { [runtime.agent]: { mode: 'docker' } },
                                        },
                                      });
                                    }}
                                    type="button"
                                  >
                                    {t('agentRuntime.detection.actions.use-docker')}
                                  </button>
                                ) : check.action === 'view-setup-guide' ? (
                                  <a
                                    className="shrink-0 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted/30"
                                    href="https://developers.openai.com/codex/"
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {t('agentRuntime.detection.actions.view-setup-guide')}
                                  </a>
                                ) : (
                                  <span className="shrink-0 text-xs opacity-80">
                                    {t(`agentRuntime.detection.actions.${check.action}`, {
                                      defaultValue: check.action,
                                    })}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('agentRuntime.detection.ready', { agent: runtime.agent })}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('runtimeSecurityPanel.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('runtimeSecurityPanel.summary', runtimeSecurityPanel.summary)}
              </p>
            </div>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </div>
          {!data ? (
            <EmptyLine>{t('runtimeSecurityPanel.loading')}</EmptyLine>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                {runtimeSecurityPanel.policies.map((policy) => (
                  <div
                    className={`rounded-md border p-3 text-xs ${
                      policy.violations === 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                        : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                    }`}
                    key={policy.strategy}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{policy.strategy}</span>
                      <span className="shrink-0 rounded-md border bg-background/70 px-1.5 py-0.5">
                        {policy.violations === 0
                          ? t('runtimeSecurityPanel.clear')
                          : `${policy.violations}`}
                      </span>
                    </div>
                    <p className="mt-1 truncate opacity-80">
                      {policy.violations === 0
                        ? t('runtimeSecurityPanel.noViolations')
                        : t('runtimeSecurityPanel.violationsFound', { count: policy.violations })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('runtimeSecurityPanel.topViolations')}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {runtimeSecurityPanel.topViolations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('runtimeSecurityPanel.noViolations')}
                    </p>
                  ) : (
                    runtimeSecurityPanel.topViolations.map((v) => (
                      <Link
                        className={`rounded-md border bg-background p-2 text-xs transition hover:bg-muted/30 ${
                          v.level === 'critical' ? riskClass('critical') : riskClass('warning')
                        }`}
                        href={v.href}
                        key={`${v.issueId}-${v.reason.slice(0, 20)}`}
                      >
                        <span className="line-clamp-2 font-medium">{v.reason}</span>
                        <p className="mt-1 truncate text-muted-foreground">{v.title}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('learningMemory.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recentLearnings.length
                    ? t('learningMemory.summary', { count: recentLearnings.length })
                    : t('learningMemory.emptySummary')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={autoMergeWorker.isPending}
                  onClick={() => autoMergeWorker.mutate({ body: {} })}
                  type="button"
                >
                  {t('learningMemory.runAutoMerge')}
                </button>
                <Lightbulb className="size-4 text-muted-foreground" />
              </div>
            </div>
            {workspacesQuery.isLoading ? (
              <EmptyLine>{t('learningMemory.loading')}</EmptyLine>
            ) : recentLearnings.length === 0 ? (
              <EmptyLine>{t('learningMemory.empty')}</EmptyLine>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {t('learningMemory.top')}
                  </h3>
                  <div className="mt-2 flex flex-col gap-2">
                    {topLearnings.map((learning) => (
                      <div className="rounded-md border p-3 text-xs" key={learning.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {t(`learningMemory.kind.${learning.kind}`)}
                          </span>
                          <span className="text-muted-foreground">
                            {t('learningMemory.confidence', {
                              value: Math.round(learning.confidence * 100),
                            })}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2">{learning.summary}</p>
                        {learning.repo ? (
                          <p className="mt-2 truncate text-muted-foreground">{learning.repo}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {t('learningMemory.stale')}
                  </h3>
                  <div className="mt-2 flex flex-col gap-2">
                    {staleLearnings.length === 0 ? (
                      <p className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                        {t('learningMemory.noStale')}
                      </p>
                    ) : (
                      staleLearnings.map((learning) => {
                        const suggestedMergeTarget = learning.similarLearningIds
                          ?.map((id) => learningById.get(id))
                          .find((item) => item && item.id !== learning.id);
                        const mergeTarget =
                          suggestedMergeTarget ??
                          topLearnings.find((item) => item.id !== learning.id);
                        return (
                          <div
                            className="rounded-md border bg-muted/20 p-3 text-xs"
                            key={learning.id}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">
                                {t(`learningMemory.kind.${learning.kind}`)}
                              </p>
                              <div className="flex shrink-0 gap-1">
                                {mergeTarget ? (
                                  <button
                                    className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted/30 disabled:opacity-60"
                                    disabled={governLearning.isPending}
                                    onClick={() =>
                                      governLearning.mutate({
                                        params: { learningId: learning.id },
                                        body: {
                                          action: 'merge',
                                          actor: 'dashboard',
                                          targetLearningId: mergeTarget.id,
                                          reason:
                                            'Merged from dashboard stale learning queue into top learning',
                                        },
                                      })
                                    }
                                    type="button"
                                  >
                                    {t('learningMemory.merge')}
                                  </button>
                                ) : null}
                                <button
                                  className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted/30 disabled:opacity-60"
                                  disabled={governLearning.isPending}
                                  onClick={() =>
                                    governLearning.mutate({
                                      params: { learningId: learning.id },
                                      body: {
                                        action: 'dismiss',
                                        actor: 'dashboard',
                                        reason: 'Dismissed from dashboard stale learning queue',
                                      },
                                    })
                                  }
                                  type="button"
                                >
                                  {t('learningMemory.dismiss')}
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 line-clamp-2">{learning.summary}</p>
                            {learning.similarLearningIds?.length ? (
                              <p className="mt-2 truncate text-muted-foreground">
                                {t('learningMemory.similar', {
                                  count: learning.similarLearningIds.length,
                                })}
                              </p>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('actionQueue.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {actionQueue.length
                    ? t('actionQueue.summary', { count: actionQueue.length })
                    : t('actionQueue.emptySummary')}
                </p>
              </div>
              <ListChecks className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!metrics ? (
                <EmptyLine>{t('actionQueue.loading')}</EmptyLine>
              ) : actionQueue.length === 0 ? (
                <EmptyLine>{t('actionQueue.empty')}</EmptyLine>
              ) : (
                actionQueue.slice(0, 6).map((item) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${actionClass(item.action)}`}
                    href={item.href}
                    key={`${item.issueId}-${item.action}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs">{item.label}</span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">
                      {item.phase ? formatDashboardPhase(item.phase) : t('actionQueue.noPhase')} ·{' '}
                      {item.priority}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('reviewInbox.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviewInbox.length
                    ? t('reviewInbox.summary', { count: reviewInbox.length })
                    : t('reviewInbox.emptySummary')}
                </p>
              </div>
              <Inbox className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!metrics || !notifications ? (
                <EmptyLine>{t('reviewInbox.loading')}</EmptyLine>
              ) : reviewInbox.length === 0 ? (
                <EmptyLine>{t('reviewInbox.empty')}</EmptyLine>
              ) : (
                reviewInboxGroups.map((group) => (
                  <div className="flex flex-col gap-2" key={group.gateKind}>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t(`reviewInbox.gates.${group.gateKind}`)}
                      </span>
                      <span>{t('reviewInbox.groupCount', { count: group.count })}</span>
                    </div>
                    {group.items.map((item) => {
                      const isConflict = item.id.endsWith('second-opinion-conflict');
                      return (
                        <div key={item.id}>
                          <Link
                            className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(item.priority)} ${isConflict ? 'rounded-b-none border-b-0' : ''}`}
                            href={item.href}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate font-medium">{item.title}</span>
                              <span className="shrink-0 text-xs">{item.label}</span>
                            </div>
                            <p className="mt-1 truncate text-xs opacity-80">{item.meta}</p>
                          </Link>
                          {isConflict ? (
                            <div className="rounded-md rounded-t-none border border-t-0 bg-muted/20 px-3 py-1.5 flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">
                                {t('reviewInbox.conflictAction')}
                              </span>
                              <Link
                                className="rounded border bg-background px-2 py-0.5 font-medium hover:bg-muted/30 transition"
                                href={`${item.href}#delivery-controls`}
                              >
                                {t('reviewInbox.resolveConflict')}
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('traceSummary.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {traceSummary
                    ? t('traceSummary.summary', {
                        recent: traceSummary.recent,
                        total: traceSummary.total,
                      })
                    : t('traceSummary.loading')}
                </p>
              </div>
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {traceSummary?.eventTypes.length ? (
                traceSummary.eventTypes.slice(0, 5).map((item) => (
                  <span className="rounded-md border px-2 py-1 text-xs" key={item.type}>
                    {formatLoopEvent(item.type, locale)} · {item.count}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{t('traceSummary.empty')}</span>
              )}
            </div>
            {traceSummary?.lastEventAt ? (
              <p className="mt-3 truncate text-xs text-muted-foreground">
                {t('traceSummary.lastEvent', { time: traceSummary.lastEventAt })}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('resumeSummary.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {resumeSummary
                    ? t('resumeSummary.summary', {
                        shards: resumeSummary.resumableShards,
                        issues: resumeSummary.affectedIssues,
                      })
                    : t('resumeSummary.loading')}
                </p>
              </div>
              <RefreshCw className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  {t('resumeSummary.resumableShards')}
                </p>
                <p className="mt-2 text-lg font-semibold">{resumeSummary?.resumableShards ?? 0}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t('resumeSummary.affectedIssues')}</p>
                <p className="mt-2 text-lg font-semibold">{resumeSummary?.affectedIssues ?? 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('capabilities.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {capabilities
                  ? t('capabilities.summary', {
                      planned: capabilities.summary.planned,
                      done: capabilities.summary.done,
                      inProgress: capabilities.summary.inProgress,
                    })
                  : t('capabilities.loading')}
              </p>
            </div>
            <ClipboardList className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {!capabilities ? (
              <EmptyLine>{t('capabilities.loadingIntegrations')}</EmptyLine>
            ) : capabilities.capabilities.length === 0 ? (
              <EmptyLine>{t('capabilities.empty')}</EmptyLine>
            ) : (
              capabilities.capabilities.slice(0, 8).map((capability) => (
                <div className="rounded-md border p-3 text-sm" key={capability.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{capability.label}</span>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs">
                      {formatLoopStatus(capability.status, locale)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {capability.summary}
                  </p>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {t('capabilities.next', {
                      step: capability.nextSteps[0] ?? t('capabilities.noNextStep'),
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
          {agentToolRegistry ? (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 lg:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('capabilities.agentRegistry')}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {agentToolRegistry.agents.map((agent) => (
                    <div className="rounded-md bg-muted/40 p-3 text-xs" key={agent.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{agent.label}</span>
                        <span>{agent.lifecycle}</span>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {agent.provider} ·{' '}
                        {t('capabilities.tools', { count: agent.toolIds.length })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('capabilities.toolRegistry')}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {agentToolRegistry.tools.slice(0, 5).map((tool) => (
                    <div className="rounded-md bg-muted/40 p-3 text-xs" key={tool.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{tool.label}</span>
                        <span>{tool.lifecycle}</span>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {formatLoopLabel(tool.kind, locale)} ·{' '}
                        {t('capabilities.owners', { count: tool.ownerAgentIds.length })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('capabilities.compatibilityChecks')}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  {agentToolRegistry.compatibilityChecks.map((check) => (
                    <div className="rounded-md bg-muted/40 p-3 text-xs" key={check.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{check.id}</span>
                        <span>{formatLoopStatus(check.status, locale)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{check.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {agentToolRegistry ? (
            <div className="mt-4 border-t pt-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('capabilities.permissionProfile.title')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('capabilities.permissionProfile.summary', permissionProfile.summary)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
                {permissionProfile.modes.map((mode) => (
                  <div className="rounded-md border bg-muted/20 p-3 text-xs" key={mode.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {t(`capabilities.permissionProfile.modes.${mode.id}`)}
                      </span>
                      <span className="rounded-md border bg-background px-2 py-0.5">
                        {t(`capabilities.permissionProfile.state.${mode.state}`)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-muted-foreground">{mode.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {agentToolRegistry ? (
            <div className="mt-4 border-t pt-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t('capabilities.providerProfile.title')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('capabilities.providerProfile.summary', providerProfile.summary)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {providerProfile.items.map((provider) => (
                  <div
                    className="rounded-md border bg-muted/20 p-3 text-xs"
                    key={provider.provider}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {formatLoopLabel(provider.provider, locale)}
                      </span>
                      <span className="rounded-md border bg-background px-2 py-0.5">
                        {formatLoopLabel(provider.runtimeMode, locale)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-muted-foreground">
                      {t('capabilities.providerProfile.evidence', {
                        agents: provider.agents,
                        active: provider.activeAgents,
                        planned: provider.plannedTools,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t('toolRegistry.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('toolRegistry.summary', toolRegistryLifecycle.summary)}
              </p>
            </div>
            <Cpu className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
            {toolRegistryLifecycle.tools.length === 0 ? (
              <EmptyLine>{t('toolRegistry.empty')}</EmptyLine>
            ) : (
              toolRegistryLifecycle.tools.map((tool) => (
                <div
                  className={`rounded-md border p-3 text-xs ${
                    tool.lifecycle === 'active'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                      : 'border-border bg-muted/20 text-muted-foreground'
                  }`}
                  key={tool.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{tool.label}</span>
                    <span className="shrink-0 rounded-md border bg-background/70 px-1.5 py-0.5">
                      {tool.lifecycle}
                    </span>
                  </div>
                  <p className="mt-1 truncate opacity-80">
                    {t(`toolRegistry.kinds.${tool.kind}`, { defaultValue: tool.kind })}
                  </p>
                  <p className="mt-1 truncate opacity-80">
                    {tool.compatibility || t('toolRegistry.noCompat')}
                  </p>
                  <p className="mt-1 truncate opacity-80">{tool.deterministicBoundary}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/20 p-3 text-xs">
            <span className="font-medium">{t('toolRegistry.compatibility')}</span>
            <span className="text-muted-foreground">
              {toolRegistryLifecycle.compatibilityStatus.pass}/
              {toolRegistryLifecycle.compatibilityStatus.total} pass ·{' '}
              {toolRegistryLifecycle.compatibilityStatus.planned} planned
            </span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">{t('agingQueue.title')}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{AGING_QUEUE_SLA_POLICY.label}</p>
              </div>
              <AlertTriangle className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!data ? (
                <EmptyLine>{t('agingQueue.loading')}</EmptyLine>
              ) : agingQueue.length === 0 ? (
                <EmptyLine>{t('agingQueue.empty')}</EmptyLine>
              ) : (
                agingQueue.map((item) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(item.level)}`}
                    href={item.href}
                    key={item.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs">
                        {t('agingQueue.stale', { hours: item.ageHours })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">
                      {formatDashboardPhase(item.phase)} ·{' '}
                      {t('agingQueue.updated', { time: item.updated })}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">{t('phaseDistribution.title')}</h2>
              <GitBranch className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {!data ? (
                <EmptyLine>{t('phaseDistribution.loading')}</EmptyLine>
              ) : phaseDistribution.length === 0 ? (
                <EmptyLine>{t('phaseDistribution.empty')}</EmptyLine>
              ) : (
                phaseDistribution.map(({ phase, label, count }) => (
                  <div
                    className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-sm"
                    key={phase}
                  >
                    <span className="truncate text-muted-foreground">{label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${Math.max(8, (count / maxPhaseCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right font-medium">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
              <Bell className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col divide-y">
              {!notifications ? (
                <EmptyLine>{t('notifications.loading')}</EmptyLine>
              ) : notifications.notifications.length === 0 ? (
                <EmptyLine>{t('notifications.empty')}</EmptyLine>
              ) : (
                notifications.notifications.map((notification) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_88px] gap-3 py-3 text-xs sm:grid-cols-[160px_minmax(0,1fr)_88px]"
                    key={notification.id}
                  >
                    <span className="hidden font-medium sm:block">
                      {formatLoopLabel(notification.kind, locale)}
                    </span>
                    <span className="truncate text-muted-foreground">{notification.title}</span>
                    <span className="text-right text-muted-foreground">
                      {formatLoopStatus(notification.status, locale)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">{t('events.title')}</h2>
              <span className="text-xs text-muted-foreground">
                {t('events.entries', { count: logs?.entries.length ?? 0 })}
              </span>
            </div>
            <div className="mt-3 flex flex-col divide-y">
              {!logs ? (
                <EmptyLine>{t('events.loading')}</EmptyLine>
              ) : logs.entries.length === 0 ? (
                <EmptyLine>{t('events.empty')}</EmptyLine>
              ) : (
                logs.entries.map((entry, index) => (
                  <div
                    className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-3 text-xs sm:grid-cols-[156px_120px_minmax(0,1fr)]"
                    key={`${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? ''}-${entry.status ?? entry.verdict ?? entry.action ?? index}`}
                  >
                    <span className="truncate text-muted-foreground">{entry.ts}</span>
                    <span className="hidden font-medium sm:block">
                      {formatLoopEvent(entry.type, locale)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {entry.issue ?? entry.loop ?? t('events.global')}{' '}
                      {entry.shard ? `· ${entry.shard}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1.5fr)_96px_120px_72px] gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
              <span>{t('table.issue')}</span>
              <span>{t('table.status')}</span>
              <span>{t('table.phase')}</span>
              <span>{t('table.priority')}</span>
            </div>
            {!data ? (
              <div className="px-4 py-10 text-sm text-muted-foreground">{t('table.loading')}</div>
            ) : data.list.length === 0 ? (
              <div className="px-4 py-10 text-sm text-muted-foreground">{t('table.empty')}</div>
            ) : (
              data.list.map(({ issue, state }) => {
                const costItem = fallbackSummary.costByIssue.get(issue.id);
                return (
                  <Link
                    className="grid grid-cols-[minmax(0,1.5fr)_96px_120px_72px] gap-3 border-b px-4 py-4 text-sm last:border-b-0 hover:bg-muted/30"
                    href={`/loops/${issue.id}`}
                    key={issue.id}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{issue.title}</span>
                      <span className="block truncate text-muted-foreground">
                        {issue.targetRepo}
                        {costItem?.tripped ? ` · ${t('table.costGuard')}` : ''}
                      </span>
                    </span>
                    <span>{formatLoopStatus(issue.status, locale)}</span>
                    <span className="truncate">
                      {formatDashboardPhase(state?.phase ?? 'PHASE_0_INTAKE')}
                    </span>
                    <span>{issue.priority}</span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
