'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  ListChecks,
  Play,
  Plus,
  RefreshCw,
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
  useResumeLoops,
} from '@/lib/api/contracts/hooks';
import {
  AGING_QUEUE_SLA_POLICY,
  aggregateLoops,
  buildAgingQueue,
  buildReviewInbox,
  buildRiskQueue,
  formatPhase,
  type RiskLevel,
} from './loops-dashboard-model';

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
    return formatPhase(phase);
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

  const data = listQuery.data?.body.data;
  const doctor = doctorQuery.data?.body.data;
  const cost = costQuery.data?.body.data;
  const agentRuntime = agentRuntimeQuery.data?.body.data as LoopAgentRuntimeResponse | undefined;
  const capabilities = capabilitiesQuery.data?.body.data as LoopCapabilitiesResponse | undefined;
  const metrics = metricsQuery.data?.body.data as LoopMetricsResponse | undefined;
  const logs = logsQuery.data?.body.data as LoopLogsResponse | undefined;
  const notifications = notificationsQuery.data?.body.data as LoopNotificationsResponse | undefined;
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
  const agingQueue = agingNow ? buildAgingQueue(fallbackSummary.items, agingNow) : [];
  const agentToolRegistry = capabilities?.capabilities.find(
    (capability) => capability.id === 'a2a-tool-registry',
  )?.agentToolRegistry;
  const actionQueue = metrics?.actionQueue ?? [];
  const reviewInbox = buildReviewInbox(actionQueue, notifications?.notifications);
  // Distinct error state: previously a failed list/doctor query rendered as
  // perpetual "loading". Surface it as an explicit banner instead.
  const dataLoadFailed = listQuery.isError || doctorQuery.isError;

  useEffect(() => {
    setAgingNow(new Date());
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

        {dataLoadFailed ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {t('loadError')}
          </div>
        ) : null}

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
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
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
                reviewInbox.map((item) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(item.priority)}`}
                    href={item.href}
                    key={item.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs">{item.label}</span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">
                      {item.source} · {item.meta}
                    </p>
                  </Link>
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
                    {item.type} · {item.count}
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
                      {capability.status}
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
                        {tool.kind} ·{' '}
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
                        <span>{check.status}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{check.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
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
                    <span className="hidden font-medium sm:block">{notification.kind}</span>
                    <span className="truncate text-muted-foreground">{notification.title}</span>
                    <span className="text-right text-muted-foreground">{notification.status}</span>
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
                logs.entries.map((entry) => (
                  <div
                    className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-3 text-xs sm:grid-cols-[156px_120px_minmax(0,1fr)]"
                    key={`${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? ''}`}
                  >
                    <span className="truncate text-muted-foreground">{entry.ts}</span>
                    <span className="hidden font-medium sm:block">{entry.type}</span>
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
                    <span>{issue.status}</span>
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
