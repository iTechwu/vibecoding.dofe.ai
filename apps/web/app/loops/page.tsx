'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  GitBranch,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type {
  LoopCostResponse,
  LoopListResponse,
  LoopLogsResponse,
  LoopNotificationsResponse,
} from '@repo/contracts';
import {
  useLoopsCost,
  useLoopsDoctor,
  useLoopsList,
  useLoopsLogs,
  useLoopsNotifications,
  useResumeLoops,
} from '@/lib/api/contracts/hooks';
import {
  aggregateLoops,
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
  const listQuery = useLoopsList({ page: 1, limit: 20 });
  const doctorQuery = useLoopsDoctor();
  const costQuery = useLoopsCost();
  const logsQuery = useLoopsLogs({ limit: 10 });
  const notificationsQuery = useLoopsNotifications({ limit: 8 });
  const resume = useResumeLoops();

  const data = listQuery.data?.body.data;
  const doctor = doctorQuery.data?.body.data;
  const cost = costQuery.data?.body.data;
  const logs = logsQuery.data?.body.data as LoopLogsResponse | undefined;
  const notifications = notificationsQuery.data?.body.data as LoopNotificationsResponse | undefined;
  const summary = aggregateLoops(data, cost);
  const riskQueue = buildRiskQueue(summary.items, cost);

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
            note={`${summary.paused} paused · ${summary.costTripped.length} cost guards`}
            value={summary.attention}
          />
          <MetricCard
            icon={<CircleDollarSign className="size-4" />}
            label="Runway"
            note={`${summary.minTokensRemaining} min tokens remaining`}
            value={`${summary.minCallsRemaining} calls`}
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
                  {doctor
                    ? doctor.ok
                      ? 'File state and DB index are currently consistent.'
                      : 'State doctor found issues that need review.'
                    : 'Loading doctor status.'}
                </p>
              </div>
              <span className="rounded-md border px-2 py-1 text-xs font-medium">
                {doctor ? (doctor.ok ? 'OK' : 'Attention') : 'Loading'}
              </span>
            </div>
            {doctor ? (
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">Loops</p>
                  <p className="mt-1 text-lg font-semibold">{doctor.loops}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">Issues</p>
                  <p className="mt-1 text-lg font-semibold">{doctor.issues}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-muted-foreground">Problems</p>
                  <p className="mt-1 text-lg font-semibold">{doctor.problems.length}</p>
                </div>
              </div>
            ) : null}
            {doctor?.problems.length ? (
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {doctor.problems.slice(0, 4).map((problem) => (
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
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">Phase Distribution</h2>
              <GitBranch className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {!data ? (
                <EmptyLine>Loading phases.</EmptyLine>
              ) : Object.keys(summary.phaseCounts).length === 0 ? (
                <EmptyLine>No phase data yet.</EmptyLine>
              ) : (
                Object.entries(summary.phaseCounts).map(([phase, count]) => (
                  <div
                    className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-sm"
                    key={phase}
                  >
                    <span className="truncate text-muted-foreground">{formatPhase(phase)}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${Math.max(8, (count / summary.maxPhaseCount) * 100)}%` }}
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
                const costItem = summary.costByIssue.get(issue.id);
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
