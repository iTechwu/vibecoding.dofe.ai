import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLoopIssue } from '@/lib/api/loops';
import {
  approveSpecAction,
  decomposeAction,
  finalizeLoopAction,
  generateSpecAction,
  globalReviewAction,
  pauseLoopAction,
  recordImplementationAction,
  reloopAction,
  requestRevisionAction,
  resumeLoopAction,
  reviewShardAction,
  runLoopAction,
  runShardTestsAction,
  takeShardAction,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function LoopIssueDetailPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  const detail = await getLoopIssue(issueId).catch(() => null);
  if (!detail) notFound();

  const generateSpec = generateSpecAction.bind(null, issueId);
  const pauseLoop = pauseLoopAction.bind(null, issueId);
  const resumeLoop = resumeLoopAction.bind(null, issueId);
  const approveSpec = approveSpecAction.bind(null, issueId);
  const requestRevision = requestRevisionAction.bind(null, issueId);
  const decompose = decomposeAction.bind(null, issueId);
  const runLoop = runLoopAction.bind(null, issueId);
  const globalReview = globalReviewAction.bind(null, issueId);
  const reloop = reloopAction.bind(null, issueId);
  const finalizeLoop = finalizeLoopAction.bind(null, issueId);
  const runShardTests = runShardTestsAction.bind(null, issueId);
  const recordImplementation = recordImplementationAction.bind(null, issueId);
  const reviewShard = reviewShardAction.bind(null, issueId);
  const takeShard = takeShardAction.bind(null, issueId);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-start justify-between border-b pb-5">
          <div>
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/loops">
              Back to queue
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{detail.issue.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {detail.issue.id} · {detail.issue.status} · {detail.state.phase}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <form action={generateSpec}>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                disabled={Boolean(detail.spec && detail.spec.status !== 'REVISION_REQUESTED')}
                type="submit"
              >
                Generate Spec
              </button>
            </form>
            <form action={runLoop}>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                disabled={
                  detail.state.paused ||
                  detail.state.phase === 'CLOSED' ||
                  detail.state.shardsDone === detail.state.shardsTotal
                }
                type="submit"
              >
                Run Step
              </button>
            </form>
            <form action={globalReview}>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                disabled={detail.state.phase !== 'PHASE_6_CONVERGE'}
                type="submit"
              >
                Global Review
              </button>
            </form>
            <form action={finalizeLoop}>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                disabled={detail.state.globalVerdict !== 'PASS' || detail.state.finalized}
                type="submit"
              >
                Finalize
              </button>
            </form>
            <form action={pauseLoop}>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                disabled={detail.state.paused}
                type="submit"
              >
                Pause
              </button>
            </form>
            <form action={resumeLoop}>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                disabled={!detail.state.paused}
                type="submit"
              >
                Resume
              </button>
            </form>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {[
            ['Round', detail.state.round],
            ['Spec', detail.state.specVersion],
            ['Shards', `${detail.state.shardsDone}/${detail.state.shardsTotal}`],
            ['Calls', detail.state.costCalls],
            ['Tokens', detail.state.costTokens],
            ['Paused', detail.state.paused ? 'yes' : 'no'],
          ].map(([label, value]) => (
            <div className="rounded-lg border p-4" key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        {detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS' ? (
          <section className="rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Re-loop</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Global verdict is {detail.state.globalVerdict}. Create the next spec revision and
              send it back through human review.
            </p>
            <form action={reloop} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                name="notes"
                placeholder="Revision notes"
              />
              <button className="h-10 rounded-md border px-4 text-sm font-medium" type="submit">
                Start Re-loop
              </button>
            </form>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col gap-6">
            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Issue Intake</h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Submitter</dt>
                  <dd>{detail.issue.submitterName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Target Repo</dt>
                  <dd className="break-all">{detail.issue.targetRepo}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Raw Payload</dt>
                  <dd>{detail.issue.rawPayloadRef}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{detail.intake.sourceChannel}</dd>
                </div>
              </dl>
              <p className="mt-5 whitespace-pre-wrap text-sm">{detail.issue.body}</p>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Spec Review</h2>
              {detail.spec ? (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {detail.spec.version} · {detail.spec.status}
                  </p>
                  <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                    {detail.spec.body}
                  </pre>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={approveSpec}>
                      <button
                        className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                        disabled={detail.spec.status === 'APPROVED'}
                        type="submit"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={requestRevision} className="flex gap-2">
                      <input
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        name="notes"
                        placeholder="Revision note"
                      />
                      <button
                        className="h-10 rounded-md border px-4 text-sm font-medium"
                        type="submit"
                      >
                        Request Revision
                      </button>
                    </form>
                    <form action={decompose}>
                      <button
                        className="h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                        disabled={detail.spec.status !== 'APPROVED'}
                        type="submit"
                      >
                        Decompose
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No spec yet.</p>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Shards</h2>
              <div className="mt-4 flex flex-col gap-3">
                {detail.shards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shards yet.</p>
                ) : (
                  detail.shards.map((shard) => (
                    <div className="rounded-md border p-3" key={shard.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{shard.title}</p>
                        <span className="text-xs text-muted-foreground">{shard.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        est_context {shard.estContext} · depends {shard.dependsOn.length || 0}
                      </p>
                      <form action={takeShard} className="mt-3 flex flex-col gap-2">
                        <input name="shardId" type="hidden" value={shard.id} />
                        <input
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          name="notes"
                          placeholder="Takeover note"
                        />
                        <button
                          className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted/30 disabled:opacity-50"
                          disabled={shard.status === 'DONE'}
                          type="submit"
                        >
                          Take Over
                        </button>
                      </form>
                      <form action={recordImplementation} className="mt-3 flex flex-col gap-2">
                        <input name="shardId" type="hidden" value={shard.id} />
                        <input name="implementer" type="hidden" value="human" />
                        <textarea
                          className="min-h-16 rounded-md border bg-background px-2 py-1 text-xs"
                          name="summary"
                          placeholder="Implementation summary"
                          required
                        />
                        <textarea
                          className="min-h-14 rounded-md border bg-background px-2 py-1 text-xs"
                          name="changedFiles"
                          placeholder="Changed files, one per line"
                        />
                        <input
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          name="notes"
                          placeholder="Notes"
                        />
                        <button
                          className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted/30"
                          type="submit"
                        >
                          Record Implementation
                        </button>
                      </form>
                      <form action={runShardTests} className="mt-3 flex flex-col gap-2">
                        <input name="shardId" type="hidden" value={shard.id} />
                        <textarea
                          className="min-h-16 rounded-md border bg-background px-2 py-1 text-xs"
                          name="commands"
                          placeholder="pnpm --version"
                        />
                        <button
                          className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted/30"
                          type="submit"
                        >
                          Run Tests
                        </button>
                      </form>
                      <form action={reviewShard} className="mt-3 flex flex-col gap-2">
                        <input name="shardId" type="hidden" value={shard.id} />
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          name="verdict"
                          defaultValue="PASS"
                        >
                          <option value="PASS">PASS</option>
                          <option value="NEEDS-WORK">NEEDS-WORK</option>
                          <option value="FAIL">FAIL</option>
                        </select>
                        <input
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          name="summary"
                          placeholder="Review summary"
                          required
                        />
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          name="severity"
                          defaultValue="major"
                        >
                          <option value="minor">minor</option>
                          <option value="major">major</option>
                          <option value="critical">critical</option>
                        </select>
                        <textarea
                          className="min-h-14 rounded-md border bg-background px-2 py-1 text-xs"
                          name="issues"
                          placeholder="Issue description"
                        />
                        <textarea
                          className="min-h-14 rounded-md border bg-background px-2 py-1 text-xs"
                          name="fixInstructions"
                          placeholder="Fix instructions, one per line"
                        />
                        <button
                          className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted/30"
                          type="submit"
                        >
                          Record Review
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Implementation Records</h2>
              <div className="mt-4 flex flex-col gap-3">
                {detail.implementationRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No implementation records yet.</p>
                ) : (
                  detail.implementationRecords.map((record) => (
                    <div className="rounded-md border p-3" key={record.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{record.shardId}</p>
                        <span className="text-xs text-muted-foreground">{record.status}</span>
                      </div>
                      <p className="mt-2 text-xs">{record.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {record.changedFiles.length} files · round {record.round}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Global Review</h2>
                <span className="text-xs text-muted-foreground">
                  {detail.globalReview?.verdict ?? 'none'}
                </span>
              </div>
              {detail.globalReview ? (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <p>{detail.globalReview.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    round {detail.globalReview.round} · {detail.globalReview.created}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No global review yet.</p>
              )}
            </div>

            <div className="rounded-lg border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Convergence PR</h2>
                <span className="text-xs text-muted-foreground">
                  {detail.convergencePr?.status ?? 'none'}
                </span>
              </div>
              {detail.convergencePr ? (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <p className="font-medium">{detail.convergencePr.branch}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {detail.convergencePr.commits.length} commits · base{' '}
                    {detail.convergencePr.baseBranch}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No convergence PR yet.</p>
              )}
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Test Matrix</h2>
              {detail.testMatrix ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{detail.testMatrix.id}</p>
                      <span className="text-xs text-muted-foreground">
                        {detail.testMatrix.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {detail.testMatrix.requiredTests.length} required ·{' '}
                      {detail.testMatrix.regressionScope.length} regression files
                    </p>
                  </div>
                  {detail.testMatrix.requiredTests.slice(0, 8).map((test) => (
                    <div className="rounded-md border p-3" key={test.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-medium">{test.title}</p>
                        <span className="text-xs text-muted-foreground">{test.level}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{test.shardId}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No test matrix yet.</p>
              )}
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Review Records</h2>
              <div className="mt-4 flex flex-col gap-3">
                {detail.reviewRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No review records yet.</p>
                ) : (
                  detail.reviewRecords.map((record) => (
                    <div className="rounded-md border p-3" key={record.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{record.shardId}</p>
                        <span className="text-xs text-muted-foreground">{record.verdict}</span>
                      </div>
                      <p className="mt-2 text-xs">{record.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {record.issues.length} issues · round {record.round}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Test Records</h2>
              <div className="mt-4 flex flex-col gap-3">
                {detail.testRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No test records yet.</p>
                ) : (
                  detail.testRecords.map((record) => (
                    <div className="rounded-md border p-3" key={record.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{record.shardId}</p>
                        <span className="text-xs text-muted-foreground">{record.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {record.commands.length} commands · round {record.round}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Annotations</h2>
              <div className="mt-4 flex flex-col gap-3">
                {detail.annotations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No annotations yet.</p>
                ) : (
                  detail.annotations.map((annotation) => (
                    <div className="rounded-md border p-3" key={annotation.target}>
                      <p className="text-sm font-medium">{annotation.target}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {annotation.implStatus} · {annotation.testStatus} · {annotation.verdict} ·{' '}
                        {annotation.risk}
                      </p>
                      <p className="mt-2 text-xs">{annotation.notes}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Event Log</h2>
              <div className="mt-4 flex flex-col divide-y">
                {detail.logs.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">No events yet.</p>
                ) : (
                  detail.logs.slice(0, 12).map((entry) => (
                    <div
                      className="grid grid-cols-[120px_1fr] gap-3 py-3 text-xs"
                      key={`${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? ''}`}
                    >
                      <span className="text-muted-foreground">{entry.ts}</span>
                      <span>
                        <span className="font-medium">{entry.type}</span>
                        <span className="ml-2 text-muted-foreground">
                          {entry.shard ?? entry.action ?? entry.status ?? entry.verdict ?? ''}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <div className="mt-4 flex flex-col divide-y">
                {detail.notifications.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">No notifications yet.</p>
                ) : (
                  detail.notifications.slice(0, 12).map((notification) => (
                    <div className="py-3 text-xs" key={notification.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{notification.kind}</span>
                        <span className="text-muted-foreground">{notification.status}</span>
                      </div>
                      <p className="mt-2 text-sm">{notification.title}</p>
                      <p className="mt-1 text-muted-foreground">{notification.body}</p>
                      <p className="mt-2 text-muted-foreground">
                        {notification.channel} · {notification.recipient} · {notification.created}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
