import Link from 'next/link';
import {
  getLoopLogs,
  getLoopNotifications,
  getLoopsCost,
  getLoopsDoctor,
  listLoops,
} from '@/lib/api/loops';
import { resumeLoopsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoopsPage() {
  const [data, doctor, cost, logs, notifications] = await Promise.all([
    listLoops(),
    getLoopsDoctor(),
    getLoopsCost(),
    getLoopLogs({ limit: 8 }),
    getLoopNotifications({ limit: 6 }),
  ]);
  const stateByIssue = new Map(data.loops.map((loop) => [loop.issueId, loop]));

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Loops Console</p>
            <h1 className="text-3xl font-semibold tracking-normal">Issue Queue</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
            href="/loops/new"
          >
            New Issue
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_180px]">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  State Doctor: {doctor.ok ? 'OK' : 'Needs Attention'}
                </p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{doctor.root}</p>
              </div>
              <span className="text-sm text-muted-foreground">
                {doctor.loops} loops · {doctor.issues} issues
              </span>
            </div>
            {doctor.problems.length > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
                {doctor.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Cost Guard</p>
            <p className="mt-2 text-2xl font-semibold">
              {cost.loops.filter((loop) => loop.tripped).length}/{cost.loops.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              tripped · {cost.loops.reduce((sum, loop) => sum + loop.costCalls, 0)} calls
            </p>
          </div>
          <form action={resumeLoopsAction}>
            <button
              className="h-full min-h-20 w-full rounded-md border px-4 text-sm font-medium hover:bg-muted/30"
              type="submit"
            >
              Resume Interrupted
            </button>
          </form>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Recent Notifications</h2>
            <span className="text-xs text-muted-foreground">
              {notifications.notifications.length} records
            </span>
          </div>
          <div className="mt-3 flex flex-col divide-y">
            {notifications.notifications.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.notifications.map((notification) => (
                <div
                  className="grid grid-cols-[140px_160px_1fr] gap-3 py-3 text-xs"
                  key={notification.id}
                >
                  <span className="font-medium">{notification.kind}</span>
                  <span className="text-muted-foreground">{notification.status}</span>
                  <span className="truncate text-muted-foreground">{notification.title}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Recent Events</h2>
            <span className="text-xs text-muted-foreground">{logs.entries.length} entries</span>
          </div>
          <div className="mt-3 flex flex-col divide-y">
            {logs.entries.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No events yet.</p>
            ) : (
              logs.entries.map((entry) => (
                <div
                  className="grid grid-cols-[160px_140px_1fr] gap-3 py-3 text-xs"
                  key={`${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? ''}`}
                >
                  <span className="text-muted-foreground">{entry.ts}</span>
                  <span className="font-medium">{entry.type}</span>
                  <span className="truncate text-muted-foreground">
                    {entry.issue ?? entry.loop ?? 'global'} {entry.shard ? `· ${entry.shard}` : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1.5fr_120px_160px_120px] gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
            <span>Issue</span>
            <span>Status</span>
            <span>Phase</span>
            <span>Priority</span>
          </div>
          {data.issues.length === 0 ? (
            <div className="px-4 py-10 text-sm text-muted-foreground">No Loops issues yet.</div>
          ) : (
            data.issues.map((issue) => {
              const loop = stateByIssue.get(issue.id);
              return (
                <Link
                  className="grid grid-cols-[1.5fr_120px_160px_120px] gap-4 border-b px-4 py-4 text-sm last:border-b-0 hover:bg-muted/30"
                  href={`/loops/${issue.id}`}
                  key={issue.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{issue.title}</span>
                    <span className="block truncate text-muted-foreground">{issue.targetRepo}</span>
                  </span>
                  <span>{issue.status}</span>
                  <span>{loop?.phase ?? 'PHASE_0_INTAKE'}</span>
                  <span>{issue.priority}</span>
                </Link>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
