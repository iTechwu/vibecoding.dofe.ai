'use client';

import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import type { LoopDetail, LoopEvidenceArtifact, LoopLogEntry } from '@repo/contracts';
import { useFormState } from './use-loop-operations';
import { useLoopIssue } from '@/lib/api/contracts/hooks';

function getNextAction(detail: LoopDetail) {
  if (detail.state.paused) {
    return {
      label: 'Resume loop',
      body: 'This issue is paused. Resume it before running more agent steps.',
      tone: 'attention',
    };
  }
  if (!detail.spec || detail.spec.status === 'REVISION_REQUESTED') {
    return {
      label: 'Generate spec',
      body: 'Create or refresh the product spec before decomposition.',
      tone: 'default',
    };
  }
  if (detail.spec.status === 'DRAFT') {
    return {
      label: 'Review spec',
      body: 'Approve, request changes, or reject the draft spec.',
      tone: 'attention',
    };
  }
  if (detail.spec.status === 'APPROVED' && detail.shards.length === 0) {
    return {
      label: 'Decompose',
      body: 'Split the approved spec into self-contained implementation shards.',
      tone: 'default',
    };
  }
  if (detail.state.phase === 'PHASE_6_CONVERGE') {
    return {
      label: 'Global review',
      body: 'Run the cross-shard review before final annotation and delivery.',
      tone: 'attention',
    };
  }
  if (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS') {
    return {
      label: 'Start re-loop',
      body: 'Global review found remaining work. Create the next spec revision.',
      tone: 'attention',
    };
  }
  if (detail.state.globalVerdict === 'PASS' && !detail.state.finalized) {
    return {
      label: 'Finalize',
      body: 'Close the issue and emit the convergence record.',
      tone: 'default',
    };
  }
  if (detail.state.phase === 'CLOSED' || detail.state.finalized) {
    return {
      label: 'Closed',
      body: 'Delivery is finalized. Review the records below for audit evidence.',
      tone: 'success',
    };
  }
  return {
    label: 'Run step',
    body: 'Advance the next runnable shard through implementation, tests, and review.',
    tone: 'default',
  };
}

function summarizeEvidence(detail: LoopDetail) {
  const total = Math.max(detail.shards.length, 1);
  const implemented = new Set(detail.implementationRecords.map((record) => record.shardId)).size;
  const tested = new Set(detail.testRecords.map((record) => record.shardId)).size;
  const reviewed = new Set(detail.reviewRecords.map((record) => record.shardId)).size;
  const annotated = detail.annotations.filter(
    (annotation) => annotation.coverage !== 'none',
  ).length;
  return [
    ['Implemented', implemented, total],
    ['Tested', tested, total],
    ['Reviewed', reviewed, total],
    ['Annotated', annotated, Math.max(detail.annotations.length, total)],
  ] as const;
}

function requirementStatusClass(status: string) {
  if (status === 'accepted' || status === 'reviewed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (status === 'missing') {
    return 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100';
  }
  return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
}

function actionToneClass(tone: string) {
  if (tone === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  return 'border-border bg-muted/40 text-foreground';
}

function traceToneClass(type: string) {
  if (type.includes('REVIEW') || type.includes('VERDICT')) {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  if (type.includes('TEST')) {
    return 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/20 dark:text-sky-100';
  }
  if (type.includes('IMPLEMENT') || type.includes('FINAL')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  return 'border-border bg-muted/40 text-foreground';
}

function summarizeLogPayload(entry: LoopLogEntry) {
  const payloadItems = Object.entries(entry.payload ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 3)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.length} items`;
      }
      if (typeof value === 'object') {
        return `${key}: object`;
      }
      return `${key}: ${String(value)}`;
    });

  return payloadItems.join(' · ');
}

function buildTraceTimeline(logs: LoopLogEntry[]) {
  return logs.slice(0, 16).map((entry, index) => ({
    id: `${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? index}`,
    time: entry.ts,
    type: entry.type,
    scope: entry.shard ?? entry.issue ?? entry.loop ?? 'loop',
    signal: entry.verdict ?? entry.status ?? entry.action ?? '',
    payload: summarizeLogPayload(entry),
  }));
}

function buildTraceScopeSummary(logs: LoopLogEntry[]) {
  const scopeMap = new Map<
    string,
    {
      id: string;
      eventCount: number;
      lastEvent: string;
      lastType: string;
      signal: string;
    }
  >();

  for (const entry of logs) {
    const id = entry.shard ?? entry.issue ?? entry.loop ?? 'loop';
    const existing = scopeMap.get(id);
    if (existing) {
      existing.eventCount += 1;
      continue;
    }
    scopeMap.set(id, {
      id,
      eventCount: 1,
      lastEvent: entry.ts,
      lastType: entry.type,
      signal: entry.verdict ?? entry.status ?? entry.action ?? '',
    });
  }

  return Array.from(scopeMap.values())
    .sort((a, b) => b.eventCount - a.eventCount || b.lastEvent.localeCompare(a.lastEvent))
    .slice(0, 6);
}

function buildResumeCheckpoints(detail: LoopDetail) {
  const latestEventByShard = new Map<string, LoopLogEntry>();
  for (const entry of detail.logs) {
    if (entry.shard && !latestEventByShard.has(entry.shard)) {
      latestEventByShard.set(entry.shard, entry);
    }
  }

  if (detail.shards.length === 0) {
    const latestEvent = detail.logs[0];
    return [
      {
        id: `${detail.issue.id}-phase`,
        label: 'Issue phase',
        status: detail.state.paused ? 'paused' : detail.state.phase,
        action: detail.state.paused ? 'Resume loop' : getNextAction(detail).label,
        meta: `round ${detail.state.round} · ${detail.state.specVersion}`,
        lastEvent: latestEvent?.ts,
        lastSignal: latestEvent
          ? `${latestEvent.type}${(latestEvent.verdict ?? latestEvent.status ?? latestEvent.action) ? ` · ${latestEvent.verdict ?? latestEvent.status ?? latestEvent.action}` : ''}`
          : undefined,
      },
    ];
  }

  return detail.shards.map((shard) => {
    const latestEvent = latestEventByShard.get(shard.id);
    const isResumable =
      detail.state.paused ||
      shard.status === 'IN_PROGRESS' ||
      shard.status === 'BLOCKED' ||
      shard.status === 'TIMEOUT' ||
      shard.status === 'FAILED' ||
      shard.status === 'NEEDS-WORK';
    return {
      id: shard.id,
      label: shard.title,
      status: shard.status,
      action: isResumable
        ? 'Resume or take over'
        : shard.status === 'DONE'
          ? 'No action'
          : 'Run step',
      meta: `${shard.estEffort} effort · ${shard.acceptance.length} acceptance checks`,
      lastEvent: latestEvent?.ts,
      lastSignal: latestEvent
        ? `${latestEvent.type}${(latestEvent.verdict ?? latestEvent.status ?? latestEvent.action) ? ` · ${latestEvent.verdict ?? latestEvent.status ?? latestEvent.action}` : ''}`
        : undefined,
    };
  });
}

function buildCheckpointDiff(detail: LoopDetail) {
  const coverage = detail.requirementsCoverage?.summary;
  const passingTests = detail.testRecords.filter((record) => record.status === 'TEST-PASS').length;
  const failedTests = detail.testRecords.filter((record) => record.status !== 'TEST-PASS').length;
  const blockedShards = detail.shards.filter((shard) =>
    ['BLOCKED', 'FAILED', 'TIMEOUT', 'NEEDS-WORK'].includes(shard.status),
  );
  return [
    {
      label: 'Spec revision',
      before: detail.state.round > 1 ? `round ${detail.state.round - 1}` : 'intake',
      after: `${detail.state.specVersion} · round ${detail.state.round}`,
    },
    {
      label: 'Requirements',
      before: `${coverage?.missing ?? detail.issue.acceptanceCriteria.length} missing`,
      after: `${coverage?.percent ?? 0}% covered`,
    },
    {
      label: 'Shards',
      before: `${blockedShards.length} blocked`,
      after: `${detail.state.shardsDone}/${detail.state.shardsTotal} done`,
    },
    {
      label: 'Tests',
      before: `${failedTests} failing`,
      after: `${passingTests} passing`,
    },
  ];
}

function artifactGroup(kind: LoopEvidenceArtifact['kind']) {
  if (kind === 'raw-payload' || kind === 'issue' || kind === 'intake') return 'Request';
  if (kind === 'spec' || kind === 'shards' || kind === 'test-matrix') return 'Planning';
  if (kind === 'implementation-record') return 'Implementation';
  if (kind === 'test-record') return 'Test';
  if (kind === 'review-record' || kind === 'global-review' || kind === 'annotations') {
    return 'Review';
  }
  return 'Delivery';
}

function artifactRecoveryHint(artifact: LoopEvidenceArtifact) {
  if (artifact.status === 'present') return 'Ready for audit';
  if (artifact.kind === 'spec') return 'Generate or approve the spec';
  if (artifact.kind === 'shards') return 'Decompose the approved spec';
  if (artifact.kind === 'test-matrix') return 'Decompose shards to create the matrix';
  if (artifact.kind === 'implementation-record') return 'Record implementation evidence';
  if (artifact.kind === 'test-record') return 'Run shard or regression tests';
  if (artifact.kind === 'review-record') return 'Record shard review evidence';
  if (artifact.kind === 'global-review') return 'Run global review';
  if (artifact.kind === 'convergence-pr') return 'Finalize the loop';
  return 'Capture the missing artifact';
}

function buildArtifactWorkspace(artifacts: LoopEvidenceArtifact[]) {
  const order = ['Request', 'Planning', 'Implementation', 'Test', 'Review', 'Delivery'];
  return order
    .map((group) => ({
      group,
      artifacts: artifacts.filter((artifact) => artifactGroup(artifact.kind) === group),
    }))
    .filter((item) => item.artifacts.length > 0);
}

export default function LoopIssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const detailQuery = useLoopIssue(issueId);
  const detail = detailQuery.data?.body.data;
  const ops = useFormState(issueId);

  if (!detail) {
    return (
      <main className="min-h-screen bg-background px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-muted-foreground">
            {detailQuery.isLoading ? 'Loading issue…' : 'Issue not found.'}
          </p>
        </div>
      </main>
    );
  }

  const nextAction = getNextAction(detail);
  const evidence = summarizeEvidence(detail);
  const requirementsCoverage = detail.requirementsCoverage ?? {
    summary: {
      total: detail.issue.acceptanceCriteria.length,
      accepted: 0,
      reviewed: 0,
      tested: 0,
      implemented: 0,
      planned: 0,
      missing: detail.issue.acceptanceCriteria.length,
      percent: detail.issue.acceptanceCriteria.length === 0 ? 100 : 0,
    },
    items: detail.issue.acceptanceCriteria.map((criterion, index) => ({
      id: `REQ-${index + 1}`,
      criterion,
      inSpec: false,
      shardIds: [],
      testIds: [],
      implementationRecordIds: [],
      reviewRecordIds: [],
      status: 'missing' as const,
    })),
  };
  const evidenceArtifacts = detail.evidenceArtifacts ?? [
    {
      id: `${detail.issue.id}-raw-payload`,
      label: 'Raw Payload',
      kind: 'raw-payload',
      path: detail.issue.rawPayloadRef,
      status: 'present',
      summary: 'Original request payload captured for audit.',
    },
    {
      id: `${detail.issue.id}-issue`,
      label: 'Issue Record',
      kind: 'issue',
      path: `.loops/issues/${detail.issue.id}.json`,
      status: 'present',
      summary: `${detail.issue.priority} ${detail.issue.status} issue with ${detail.issue.acceptanceCriteria.length} acceptance criteria.`,
    },
    {
      id: `${detail.issue.id}-intake`,
      label: 'Intake Record',
      kind: 'intake',
      path: `.loops/intakes/${detail.intake.id}.json`,
      status: 'present',
      summary: `${detail.intake.status} intake normalized from ${detail.intake.sourceChannel}.`,
    },
  ];
  const traceTimeline = buildTraceTimeline(detail.logs);
  const traceScopeSummary = buildTraceScopeSummary(detail.logs);
  const resumeCheckpoints = buildResumeCheckpoints(detail);
  const checkpointDiff = buildCheckpointDiff(detail);
  const artifactWorkspace = buildArtifactWorkspace(evidenceArtifacts);

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
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
              disabled={Boolean(detail.spec && detail.spec.status !== 'REVISION_REQUESTED')}
              onClick={ops.generateSpec}
              type="button"
            >
              Generate Spec
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
              disabled={
                detail.state.paused ||
                detail.state.phase === 'CLOSED' ||
                detail.state.shardsDone === detail.state.shardsTotal
              }
              onClick={ops.runLoop}
              type="button"
            >
              Run Step
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
              disabled={detail.state.phase !== 'PHASE_6_CONVERGE'}
              onClick={ops.globalReview}
              type="button"
            >
              Global Review
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
              disabled={detail.state.globalVerdict !== 'PASS' || detail.state.finalized}
              onClick={ops.finalizeLoop}
              type="button"
            >
              Finalize
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-50"
              disabled={detail.state.paused}
              onClick={ops.pauseLoop}
              type="button"
            >
              Pause
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
              disabled={!detail.state.paused}
              onClick={ops.resumeLoop}
              type="button"
            >
              Resume
            </button>
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

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className={`rounded-lg border p-4 ${actionToneClass(nextAction.tone)}`}>
            <p className="text-sm font-medium">Next Action</p>
            <h2 className="mt-2 text-xl font-semibold">{nextAction.label}</h2>
            <p className="mt-2 text-sm opacity-80">{nextAction.body}</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">Evidence Coverage</h2>
              <span className="text-xs text-muted-foreground">
                {detail.shards.length} shards · {detail.annotations.length} annotations
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {evidence.map(([label, done, total]) => (
                <div className="rounded-md bg-muted/40 p-3" key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-lg font-semibold">
                    {done}/{total}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS' ? (
          <section className="rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Re-loop</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Global verdict is {detail.state.globalVerdict}. Create the next spec revision and send
              it back through human review.
            </p>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={ops.reloop}>
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Initial Requirements Coverage</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {requirementsCoverage.summary.accepted}/{requirementsCoverage.summary.total}{' '}
                    accepted · {requirementsCoverage.summary.percent}%
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${requirementStatusClass(
                    requirementsCoverage.summary.percent === 100 ? 'accepted' : 'missing',
                  )}`}
                >
                  {requirementsCoverage.summary.percent === 100 ? 'covered' : 'needs work'}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {requirementsCoverage.items.map((item) => (
                  <div className="rounded-md border p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{item.criterion}</p>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-1 text-xs ${requirementStatusClass(
                          item.status,
                        )}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      spec {item.inSpec ? 'yes' : 'no'} · shards {item.shardIds.length} · tests{' '}
                      {item.testIds.length} · reviews {item.reviewRecordIds.length}
                    </p>
                  </div>
                ))}
              </div>
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
                    <button
                      className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                      disabled={detail.spec.status === 'APPROVED'}
                      onClick={ops.approveSpec}
                      type="button"
                    >
                      Approve
                    </button>
                    <form className="flex gap-2" onSubmit={ops.requestRevision}>
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
                    <button
                      className="h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-50"
                      disabled={detail.spec.status !== 'APPROVED'}
                      onClick={ops.decompose}
                      type="button"
                    >
                      Decompose
                    </button>
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
                      <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => ops.takeShard(e)}>
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
                      <form
                        className="mt-3 flex flex-col gap-2"
                        onSubmit={(e) => ops.recordImplementation(e)}
                      >
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
                      <form
                        className="mt-3 flex flex-col gap-2"
                        onSubmit={(e) => ops.runShardTests(e)}
                      >
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
                      <form
                        className="mt-3 flex flex-col gap-2"
                        onSubmit={(e) => ops.reviewShard(e)}
                      >
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
                <h2 className="text-lg font-semibold">Evidence Artifact Workspace</h2>
                <span className="text-xs text-muted-foreground">
                  {evidenceArtifacts.filter((item) => item.status === 'present').length}/
                  {evidenceArtifacts.length} present
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {artifactWorkspace.map(({ group, artifacts }) => (
                  <div className="rounded-md border p-3" key={group}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">{group}</h3>
                      <span className="text-xs text-muted-foreground">
                        {artifacts.filter((item) => item.status === 'present').length}/
                        {artifacts.length}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {artifacts.map((artifact) => (
                        <div className="rounded-md bg-muted/30 p-3" key={artifact.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium">{artifact.label}</p>
                            <span className="text-xs text-muted-foreground">{artifact.status}</span>
                          </div>
                          <p className="mt-2 break-all text-xs text-muted-foreground">
                            {artifact.kind} · {artifact.path}
                            {artifact.count !== undefined ? ` · ${artifact.count}` : ''}
                          </p>
                          {artifact.summary ? (
                            <p className="mt-2 text-xs text-foreground">{artifact.summary}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {artifactRecoveryHint(artifact)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
                  {detail.convergencePr.url ? (
                    <a
                      className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                      href={detail.convergencePr.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open {detail.convergencePr.provider ?? 'remote'} PR
                    </a>
                  ) : null}
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
                      {record.coverage ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          coverage lines {record.coverage.lines ?? '-'}% · branches{' '}
                          {record.coverage.branches ?? '-'}%
                        </p>
                      ) : null}
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
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Resume Checkpoints</h2>
                <span className="text-xs text-muted-foreground">
                  {resumeCheckpoints.length} checkpoints
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  <h3 className="text-sm font-medium">Checkpoint Diff</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {checkpointDiff.map((item) => (
                      <div className="rounded-md bg-background p-3 text-xs" key={item.label}>
                        <p className="font-medium">{item.label}</p>
                        <p className="mt-1 text-muted-foreground">
                          {item.before} to {item.after}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                {resumeCheckpoints.map((checkpoint) => (
                  <div className="rounded-md border p-3" key={checkpoint.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{checkpoint.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{checkpoint.meta}</p>
                      </div>
                      <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                        {checkpoint.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {checkpoint.action}
                      {checkpoint.lastSignal ? ` · ${checkpoint.lastSignal}` : ''}
                      {checkpoint.lastEvent ? ` · last event ${checkpoint.lastEvent}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Trace Timeline</h2>
                <span className="text-xs text-muted-foreground">
                  {traceTimeline.length}/{detail.logs.length} events
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium">Scope Summary</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {traceScopeSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No trace scopes yet.</p>
                  ) : (
                    traceScopeSummary.map((scope) => (
                      <div className="rounded-md border bg-muted/20 p-3" key={scope.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">{scope.id}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {scope.eventCount} events
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {scope.lastType}
                          {scope.signal ? ` · ${scope.signal}` : ''} · last {scope.lastEvent}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {traceTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trace events yet.</p>
                ) : (
                  traceTimeline.map((entry) => (
                    <div className="grid grid-cols-[18px_1fr] gap-3" key={entry.id}>
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-foreground" />
                        <span className="mt-1 min-h-8 w-px flex-1 bg-border" />
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{entry.type}</p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {entry.time} · {entry.scope}
                            </p>
                          </div>
                          {entry.signal ? (
                            <span
                              className={`rounded-md border px-2 py-1 text-xs ${traceToneClass(
                                entry.type,
                              )}`}
                            >
                              {entry.signal}
                            </span>
                          ) : null}
                        </div>
                        {entry.payload ? (
                          <p className="mt-2 break-words text-xs text-muted-foreground">
                            {entry.payload}
                          </p>
                        ) : null}
                      </div>
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
