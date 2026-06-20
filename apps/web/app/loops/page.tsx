'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Inbox,
  GitBranch,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type {
  LoopCapabilitiesResponse,
  LoopLogsResponse,
  LoopMetricsResponse,
  LoopNotificationsResponse,
} from '@repo/contracts';
import {
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
  const [agingNow, setAgingNow] = useState<Date | null>(null);
  const listQuery = useLoopsList({ page: 1, limit: 20 });
  const doctorQuery = useLoopsDoctor();
  const costQuery = useLoopsCost();
  const capabilitiesQuery = useLoopsCapabilities();
  const metricsQuery = useLoopsMetrics();
  const logsQuery = useLoopsLogs({ limit: 10 });
  const notificationsQuery = useLoopsNotifications({ limit: 8 });
  const resume = useResumeLoops();

  const data = listQuery.data?.body.data;
  const doctor = doctorQuery.data?.body.data;
  const cost = costQuery.data?.body.data;
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
      label: formatPhase(phase),
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
      meta: risk.phase ? formatPhase(risk.phase) : risk.status,
    })) ?? buildRiskQueue(fallbackSummary.items, cost);
  const traceSummary = metrics?.traceSummary;
  const resumeSummary = metrics?.resumeSummary;
  const agingQueue = agingNow ? buildAgingQueue(fallbackSummary.items, agingNow) : [];
  const agentToolRegistry = capabilities?.capabilities.find(
    (capability) => capability.id === 'a2a-tool-registry',
  )?.agentToolRegistry;
  const actionQueue = metrics?.actionQueue ?? [];
  const reviewInbox = buildReviewInbox(actionQueue, notifications?.notifications);

  useEffect(() => {
    setAgingNow(new Date());
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Loops Control Plane</p>
            <h1 className="text-3xl font-semibold tracking-normal">Agent Delivery Console</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted/30 disabled:opacity-60"
              disabled={resume.isPending}
              onClick={() => resume.mutate({ body: {} })}
              type="button"
            >
              <RefreshCw className="size-4" />
              {resume.isPending ? 'Resuming' : 'Resume Interrupted'}
            </button>
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background"
              href="/loops/new"
            >
              <Plus className="size-4" />
              New Issue
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={<Activity className="size-4" />}
            label="Active"
            note={`${summary.total} total indexed issues`}
            value={summary.active}
          />
          <MetricCard
            icon={<Play className="size-4" />}
            label="In Loop"
            note="currently under agent execution"
            value={summary.inLoop}
          />
          <MetricCard
            icon={<AlertTriangle className="size-4" />}
            label="Needs Attention"
            note={`${summary.paused} paused · ${costSummary?.tripped ?? fallbackSummary.costTripped.length} cost guards`}
            value={summary.attention}
          />
          <MetricCard
            icon={<CircleDollarSign className="size-4" />}
            label="Runway"
            note={`${costSummary?.minTokensRemaining ?? fallbackSummary.minTokensRemaining} min tokens remaining`}
            value={`${costSummary?.minCallsRemaining ?? fallbackSummary.minCallsRemaining} calls`}
          />
          <MetricCard
            icon={<CheckCircle2 className="size-4" />}
            label="Closed"
            note="finalized delivery loops"
            value={summary.closed}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Runtime Health</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {health
                    ? health.ok
                      ? 'File state and DB index are currently consistent.'
                      : 'State doctor found issues that need review.'
                    : 'Loading doctor status.'}
                </p>
              </div>
              <span className="rounded-md border px-2 py-1 text-xs font-medium">
                {health ? (health.ok ? 'OK' : 'Attention') : 'Loading'}
              </span>
            </div>
            {health ? (
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">Loops</p>
                  <p className="mt-1 text-lg font-semibold">{health.loops}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">Issues</p>
                  <p className="mt-1 text-lg font-semibold">{health.issues}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">Problems</p>
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
            <h2 className="text-sm font-semibold">Risk Queue</h2>
            <div className="mt-3 flex flex-col gap-2">
              {!data ? (
                <EmptyLine>Loading risk queue.</EmptyLine>
              ) : riskQueue.length === 0 ? (
                <EmptyLine>No priority risks detected.</EmptyLine>
              ) : (
                riskQueue.map((risk) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(risk.level)}`}
                    href={risk.href}
                    key={risk.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{risk.title}</span>
                      <span className="shrink-0 text-xs">{risk.reason}</span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">{risk.meta}</p>
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
                <h2 className="text-sm font-semibold">Action Queue</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {actionQueue.length
                    ? `${actionQueue.length} next actions sorted by the loop scheduler`
                    : 'No scheduler actions are waiting.'}
                </p>
              </div>
              <ListChecks className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!metrics ? (
                <EmptyLine>Loading action queue.</EmptyLine>
              ) : actionQueue.length === 0 ? (
                <EmptyLine>No pending actions.</EmptyLine>
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
                      {item.phase ? formatPhase(item.phase) : 'No phase'} · {item.priority}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Review Inbox</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviewInbox.length
                    ? `${reviewInbox.length} human review and takeover items`
                    : 'No human review items are waiting.'}
                </p>
              </div>
              <Inbox className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!metrics || !notifications ? (
                <EmptyLine>Loading review inbox.</EmptyLine>
              ) : reviewInbox.length === 0 ? (
                <EmptyLine>No review items.</EmptyLine>
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
                <h2 className="text-sm font-semibold">Trace Summary</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {traceSummary
                    ? `${traceSummary.recent} recent events from ${traceSummary.total} indexed entries`
                    : 'Loading trace summary.'}
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
                <span className="text-sm text-muted-foreground">No trace events yet.</span>
              )}
            </div>
            {traceSummary?.lastEventAt ? (
              <p className="mt-3 truncate text-xs text-muted-foreground">
                Last event {traceSummary.lastEventAt}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Resume Summary</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {resumeSummary
                    ? `${resumeSummary.resumableShards} shards can be recovered across ${resumeSummary.affectedIssues} issues`
                    : 'Loading resume summary.'}
                </p>
              </div>
              <RefreshCw className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Resumable Shards</p>
                <p className="mt-2 text-lg font-semibold">{resumeSummary?.resumableShards ?? 0}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Affected Issues</p>
                <p className="mt-2 text-lg font-semibold">{resumeSummary?.affectedIssues ?? 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Capability Registry</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {capabilities
                  ? `${capabilities.summary.planned} planned · ${capabilities.summary.done} done · ${capabilities.summary.inProgress} in progress`
                  : 'Loading capability registry.'}
              </p>
            </div>
            <ClipboardList className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {!capabilities ? (
              <EmptyLine>Loading planned integrations.</EmptyLine>
            ) : capabilities.capabilities.length === 0 ? (
              <EmptyLine>No capabilities registered.</EmptyLine>
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
                    Next: {capability.nextSteps[0] ?? 'No next step recorded'}
                  </p>
                </div>
              ))
            )}
          </div>
          {agentToolRegistry ? (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 lg:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">Agent Registry</h3>
                <div className="mt-2 flex flex-col gap-2">
                  {agentToolRegistry.agents.map((agent) => (
                    <div className="rounded-md bg-muted/40 p-3 text-xs" key={agent.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{agent.label}</span>
                        <span>{agent.lifecycle}</span>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {agent.provider} · {agent.toolIds.length} tools
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">Tool Registry</h3>
                <div className="mt-2 flex flex-col gap-2">
                  {agentToolRegistry.tools.slice(0, 5).map((tool) => (
                    <div className="rounded-md bg-muted/40 p-3 text-xs" key={tool.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{tool.label}</span>
                        <span>{tool.lifecycle}</span>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {tool.kind} · {tool.ownerAgentIds.length} owners
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Compatibility Checks
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
                <h2 className="text-sm font-semibold">Aging Queue</h2>
                <p className="mt-1 text-xs text-muted-foreground">{AGING_QUEUE_SLA_POLICY.label}</p>
              </div>
              <AlertTriangle className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {!data ? (
                <EmptyLine>Loading aging queue.</EmptyLine>
              ) : agingQueue.length === 0 ? (
                <EmptyLine>No stale active issues.</EmptyLine>
              ) : (
                agingQueue.map((item) => (
                  <Link
                    className={`rounded-md border p-3 text-sm transition hover:opacity-80 ${riskClass(item.level)}`}
                    href={item.href}
                    key={item.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs">{item.ageHours}h stale</span>
                    </div>
                    <p className="mt-1 truncate text-xs opacity-80">
                      {formatPhase(item.phase)} · updated {item.updated}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">Phase Distribution</h2>
              <GitBranch className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {!data ? (
                <EmptyLine>Loading phases.</EmptyLine>
              ) : phaseDistribution.length === 0 ? (
                <EmptyLine>No phase data yet.</EmptyLine>
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
              <h2 className="text-sm font-semibold">Recent Notifications</h2>
              <Bell className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex flex-col divide-y">
              {!notifications ? (
                <EmptyLine>Loading notifications.</EmptyLine>
              ) : notifications.notifications.length === 0 ? (
                <EmptyLine>No notifications yet.</EmptyLine>
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
              <h2 className="text-sm font-semibold">Recent Events</h2>
              <span className="text-xs text-muted-foreground">
                {logs?.entries.length ?? 0} entries
              </span>
            </div>
            <div className="mt-3 flex flex-col divide-y">
              {!logs ? (
                <EmptyLine>Loading events.</EmptyLine>
              ) : logs.entries.length === 0 ? (
                <EmptyLine>No events yet.</EmptyLine>
              ) : (
                logs.entries.map((entry) => (
                  <div
                    className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-3 text-xs sm:grid-cols-[156px_120px_minmax(0,1fr)]"
                    key={`${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? ''}`}
                  >
                    <span className="truncate text-muted-foreground">{entry.ts}</span>
                    <span className="hidden font-medium sm:block">{entry.type}</span>
                    <span className="truncate text-muted-foreground">
                      {entry.issue ?? entry.loop ?? 'global'}{' '}
                      {entry.shard ? `· ${entry.shard}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1.5fr)_96px_120px_72px] gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
              <span>Issue</span>
              <span>Status</span>
              <span>Phase</span>
              <span>Priority</span>
            </div>
            {!data ? (
              <div className="px-4 py-10 text-sm text-muted-foreground">Loading issues.</div>
            ) : data.list.length === 0 ? (
              <div className="px-4 py-10 text-sm text-muted-foreground">No Loops issues yet.</div>
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
                        {costItem?.tripped ? ' · cost guard' : ''}
                      </span>
                    </span>
                    <span>{issue.status}</span>
                    <span className="truncate">
                      {formatPhase(state?.phase ?? 'PHASE_0_INTAKE')}
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
