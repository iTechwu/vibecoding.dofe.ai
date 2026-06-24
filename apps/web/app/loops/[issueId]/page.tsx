'use client';

import type { ComponentType, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bot,
  Archive,
  ChevronLeft,
  CircleDot,
  ClipboardCheck,
  FileText,
  GitPullRequest,
  Info,
  Lightbulb,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@dofe/infra-web-runtime/cn';
import type {
  LoopAgentRuntimeResponse,
  LoopDetail,
  LoopEvidenceArtifact,
  LoopLogEntry,
  LoopSpecHistoryItem,
} from '@repo/contracts';
import { useFormState } from './use-loop-operations';
import {
  useLoopIssue,
  useLoopsAgentRuntime,
  useLoopDeliveryEvidence,
  getBrowserQaArtifactUrl,
} from '@/lib/api/contracts/hooks';
import { buildAgentHandoffTimeline, type WorkforcePersonaId } from '../loops-dashboard-model';
import {
  formatLoopEvent,
  formatLoopLabel,
  formatLoopSignal,
  formatLoopStatus,
} from '../loops-display';

function getNextAction(detail: LoopDetail) {
  if (detail.state.paused) {
    return { key: 'resume', tone: 'attention' };
  }
  if (!detail.spec || detail.spec.status === 'REVISION_REQUESTED') {
    return { key: 'generateSpec', tone: 'default' };
  }
  if (detail.spec.status === 'DRAFT') {
    return { key: 'reviewSpec', tone: 'attention' };
  }
  if (detail.spec.status === 'APPROVED' && detail.shards.length === 0) {
    return { key: 'decompose', tone: 'default' };
  }
  if (detail.state.phase === 'PHASE_6_CONVERGE') {
    return { key: 'globalReview', tone: 'attention' };
  }
  if (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS') {
    return { key: 'reloop', tone: 'attention' };
  }
  if (detail.state.globalVerdict === 'PASS' && !detail.state.finalized) {
    return { key: 'finalize', tone: 'default' };
  }
  if (detail.state.phase === 'CLOSED' || detail.state.finalized) {
    return { key: 'closed', tone: 'success' };
  }
  return { key: 'runStep', tone: 'default' };
}

function getRunnableShard(detail: LoopDetail) {
  return detail.shards.find(
    (shard) =>
      (shard.status === 'TODO' || shard.status === 'NEEDS-WORK') &&
      shard.dependsOn.every((dependency) =>
        detail.shards.some(
          (candidate) => candidate.id === dependency && candidate.status === 'DONE',
        ),
      ),
  );
}

function getRunStepBlocker(detail: LoopDetail) {
  if (detail.state.paused) return 'paused';
  if (detail.state.phase === 'CLOSED' || detail.state.finalized) return 'closed';
  if (!detail.spec || detail.spec.status !== 'APPROVED') return 'spec';
  if (detail.shards.length === 0) return 'shards';
  if (detail.state.shardsDone === detail.state.shardsTotal && detail.state.shardsTotal > 0) {
    return 'complete';
  }
  if (getRunnableShard(detail)) return undefined;
  if (detail.shards.some((shard) => shard.status === 'IN_PROGRESS' || shard.status === 'TIMEOUT')) {
    return undefined;
  }
  if (
    detail.shards.some(
      (shard) =>
        shard.status === 'TODO' &&
        shard.dependsOn.some((dependency) =>
          detail.shards.some(
            (candidate) => candidate.id === dependency && candidate.status !== 'DONE',
          ),
        ),
    )
  ) {
    return 'dependencies';
  }
  return 'none';
}

function getRecoverableShard(detail: LoopDetail) {
  return detail.shards.find(
    (shard) => shard.status === 'IN_PROGRESS' || shard.status === 'TIMEOUT',
  );
}

function canAdvanceLoop(detail: LoopDetail) {
  if (detail.issue.status === 'CLOSED' || detail.state.phase === 'CLOSED') return false;
  if (detail.spec?.status === 'DRAFT') return false;
  if (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS') return false;
  return true;
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
    ['implemented', implemented, total],
    ['tested', tested, total],
    ['reviewed', reviewed, total],
    ['annotated', annotated, Math.max(detail.annotations.length, total)],
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

function deliveryStatusClass(status: string) {
  if (status === 'passed' || status === 'ready' || status === 'shipped') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (status === 'current') {
    return 'border-foreground bg-foreground text-background';
  }
  if (status === 'blocked' || status === 'needs_changes') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-border bg-muted/30 text-muted-foreground';
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

function summarizeLogPayload(entry: LoopLogEntry, locale?: string) {
  const payloadItems = Object.entries(entry.payload ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 3)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${formatLoopLabel(key, locale)}: ${value.length} items`;
      }
      if (typeof value === 'object') {
        return `${formatLoopLabel(key, locale)}: object`;
      }
      return `${formatLoopLabel(key, locale)}: ${String(value)}`;
    });

  return payloadItems.join(' · ');
}

function buildTraceTimeline(logs: LoopLogEntry[], locale?: string) {
  return logs.slice(0, 16).map((entry, index) => ({
    id: `${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? 'loop'}-${index}`,
    time: entry.ts,
    type: entry.type,
    typeLabel: formatLoopEvent(entry.type, locale),
    scope: entry.shard ?? entry.issue ?? entry.loop ?? 'loop',
    signal: formatLoopSignal(entry.verdict ?? entry.status ?? entry.action ?? '', locale),
    payload: summarizeLogPayload(entry, locale),
  }));
}

function buildTraceScopeSummary(logs: LoopLogEntry[], locale?: string) {
  const scopeMap = new Map<
    string,
    {
      id: string;
      eventCount: number;
      lastEvent: string;
      lastType: string;
      lastTypeLabel: string;
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
      lastTypeLabel: formatLoopEvent(entry.type, locale),
      signal: formatLoopSignal(entry.verdict ?? entry.status ?? entry.action ?? '', locale),
    });
  }

  return Array.from(scopeMap.values())
    .sort((a, b) => b.eventCount - a.eventCount || b.lastEvent.localeCompare(a.lastEvent))
    .slice(0, 6);
}

function buildResumeCheckpoints(
  detail: LoopDetail,
  format: (key: string, values?: Record<string, string | number>) => string,
  locale?: string,
) {
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
        label: format('resumeCheckpoints.issuePhase'),
        status: detail.state.paused
          ? formatLoopStatus('paused', locale)
          : formatLoopStatus(detail.state.phase, locale),
        action: detail.state.paused
          ? format('nextAction.resume.label')
          : format(`nextAction.${getNextAction(detail).key}.label`),
        meta: format('resumeCheckpoints.meta', {
          round: detail.state.round,
          version: detail.state.specVersion,
        }),
        lastEvent: latestEvent?.ts,
        lastSignal: latestEvent
          ? `${formatLoopEvent(latestEvent.type, locale)}${(latestEvent.verdict ?? latestEvent.status ?? latestEvent.action) ? ` · ${formatLoopSignal(latestEvent.verdict ?? latestEvent.status ?? latestEvent.action, locale)}` : ''}`
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
      status: formatLoopStatus(shard.status, locale),
      action: isResumable
        ? format('resumeCheckpoints.resumeOrTakeOver')
        : shard.status === 'DONE'
          ? format('resumeCheckpoints.noAction')
          : format('nextAction.runStep.label'),
      meta: format('resumeCheckpoints.shardMeta', {
        effort: shard.estEffort,
        checks: shard.acceptance.length,
      }),
      lastEvent: latestEvent?.ts,
      lastSignal: latestEvent
        ? `${formatLoopEvent(latestEvent.type, locale)}${(latestEvent.verdict ?? latestEvent.status ?? latestEvent.action) ? ` · ${formatLoopSignal(latestEvent.verdict ?? latestEvent.status ?? latestEvent.action, locale)}` : ''}`
        : undefined,
    };
  });
}

function buildCheckpointDiff(
  detail: LoopDetail,
  format: (key: string, values?: Record<string, string | number>) => string,
) {
  const coverage = detail.requirementsCoverage?.summary;
  const passingTests = detail.testRecords.filter((record) => record.status === 'TEST-PASS').length;
  const failedTests = detail.testRecords.filter((record) => record.status !== 'TEST-PASS').length;
  const blockedShards = detail.shards.filter((shard) =>
    ['BLOCKED', 'FAILED', 'TIMEOUT', 'NEEDS-WORK'].includes(shard.status),
  );
  return [
    {
      label: format('resumeCheckpoints.labels.specRevision'),
      before:
        detail.state.round > 1
          ? format('resumeCheckpoints.values.round', { round: detail.state.round - 1 })
          : format('resumeCheckpoints.values.intake'),
      after: `${detail.state.specVersion} · ${format('resumeCheckpoints.values.round', {
        round: detail.state.round,
      })}`,
    },
    {
      label: format('resumeCheckpoints.labels.requirements'),
      before: format('resumeCheckpoints.values.missing', {
        count: coverage?.missing ?? detail.issue.acceptanceCriteria.length,
      }),
      after: format('resumeCheckpoints.values.covered', { percent: coverage?.percent ?? 0 }),
    },
    {
      label: format('resumeCheckpoints.labels.shards'),
      before: format('resumeCheckpoints.values.blocked', { count: blockedShards.length }),
      after: format('resumeCheckpoints.values.done', {
        done: detail.state.shardsDone,
        total: detail.state.shardsTotal,
      }),
    },
    {
      label: format('resumeCheckpoints.labels.tests'),
      before: format('resumeCheckpoints.values.failing', { count: failedTests }),
      after: format('resumeCheckpoints.values.passing', { count: passingTests }),
    },
  ];
}

function artifactGroup(kind: LoopEvidenceArtifact['kind']) {
  if (kind === 'raw-payload' || kind === 'issue' || kind === 'intake') return 'request';
  if (kind === 'spec' || kind === 'shards' || kind === 'test-matrix') return 'planning';
  if (kind === 'implementation-record') return 'implementation';
  if (kind === 'test-record') return 'test';
  if (kind === 'review-record' || kind === 'global-review' || kind === 'annotations') {
    return 'review';
  }
  return 'delivery';
}

function artifactRecoveryHintKey(artifact: LoopEvidenceArtifact) {
  if (artifact.status === 'present') return 'ready';
  if (artifact.kind === 'spec') return 'spec';
  if (artifact.kind === 'shards') return 'shards';
  if (artifact.kind === 'test-matrix') return 'testMatrix';
  if (artifact.kind === 'implementation-record') return 'implementationRecord';
  if (artifact.kind === 'test-record') return 'testRecord';
  if (artifact.kind === 'review-record') return 'reviewRecord';
  if (artifact.kind === 'global-review') return 'globalReview';
  if (artifact.kind === 'convergence-pr') return 'convergencePr';
  return 'fallback';
}

function buildArtifactWorkspace(artifacts: LoopEvidenceArtifact[]) {
  const order = ['request', 'planning', 'implementation', 'test', 'review', 'delivery'];
  return order
    .map((group) => ({
      group,
      artifacts: artifacts.filter((artifact) => artifactGroup(artifact.kind) === group),
    }))
    .filter((item) => item.artifacts.length > 0);
}

function filterCurrentRoundArtifacts(artifacts: LoopEvidenceArtifact[], round: number) {
  return artifacts.filter((artifact) => artifact.round === undefined || artifact.round === round);
}

function filterCurrentRound<T extends { round: number }>(items: T[], round: number) {
  return items.filter((item) => item.round === round);
}

function normalizeSpecLines(body: string) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSpecDiffReview(detail: LoopDetail) {
  if (!detail.spec) return undefined;
  const history = detail.specHistory ?? [];
  const current =
    history.find((item) => item.version === detail.spec?.version) ??
    ({
      id: detail.spec.id,
      issueId: detail.spec.issueId,
      version: detail.spec.version,
      status: detail.spec.status,
      created: detail.spec.created,
      approvedBy: detail.spec.approvedBy,
      body: detail.spec.body,
    } satisfies LoopSpecHistoryItem);
  const currentIndex = history.findIndex((item) => item.version === current.version);
  const previous =
    currentIndex > 0
      ? history[currentIndex - 1]
      : history.filter((item) => item.version !== current.version).at(-1);

  if (!previous) return undefined;

  const previousLines = new Set(normalizeSpecLines(previous.body));
  const currentLines = new Set(normalizeSpecLines(current.body));
  const added = [...currentLines].filter((line) => !previousLines.has(line));
  const removed = [...previousLines].filter((line) => !currentLines.has(line));

  return {
    fromVersion: previous.version,
    toVersion: current.version,
    added: added.length,
    removed: removed.length,
    unchanged: [...currentLines].filter((line) => previousLines.has(line)).length,
    addedPreview: added.slice(0, 3),
    removedPreview: removed.slice(0, 3),
  };
}

type IconComponent = ComponentType<{ className?: string }>;

function SectionCard({
  children,
  className = '',
  title,
  meta,
  icon: Icon,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  meta?: ReactNode;
  icon?: IconComponent;
}) {
  return (
    <section className={cn('rounded-lg border bg-background', className)}>
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <Icon className="size-4" />
            </span>
          ) : null}
          <h2 className="text-balance text-base font-semibold">{title}</h2>
        </div>
        {meta ? <div className="shrink-0 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 max-w-full items-center rounded-md border px-2.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

function MetricTile({
  label,
  value,
  muted,
}: {
  label: ReactNode;
  value: ReactNode;
  muted?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold leading-6 tabular-nums">{value}</p>
      {muted ? <p className="mt-1 text-xs text-muted-foreground">{muted}</p> : null}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  icon: Icon,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  icon: IconComponent;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={cn(
        'inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        primary
          ? 'border-foreground bg-foreground text-background'
          : 'bg-background hover:bg-muted/40',
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  );
}

const FLOW_PHASES = [
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
] as const;

const PHASE_OWNER: Record<string, 'codex' | 'claude-code' | 'system' | 'human'> = {
  PHASE_0_INTAKE: 'system',
  PHASE_1_SPEC: 'codex',
  PHASE_2_REVIEW: 'human',
  PHASE_3_DECOMPOSE: 'codex',
  PHASE_4_IMPLEMENT: 'claude-code',
  PHASE_5_REVIEW: 'codex',
  PHASE_6_CONVERGE: 'codex',
  PHASE_7_GLOBAL_REVIEW: 'codex',
  PHASE_8_ANNOTATE: 'codex',
  CLOSED: 'system',
};

function formatAgentName(agent?: string | null) {
  if (agent === 'claude-code') return 'Claude Code';
  if (agent === 'codex') return 'Codex';
  if (agent === 'human') return 'Human';
  if (agent === 'system') return 'System';
  return 'Unknown';
}

const DETAIL_PERSONA_LABELS: Record<WorkforcePersonaId, string> = {
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

function handoffBackendLabel(backend: 'codex-cli' | 'claude-code-cli' | 'human' | 'system') {
  if (backend === 'codex-cli') return 'Codex CLI';
  if (backend === 'claude-code-cli') return 'Claude Code CLI';
  if (backend === 'human') return 'Human';
  return 'System';
}

function getActiveShard(detail: LoopDetail) {
  return (
    detail.shards.find((shard) =>
      ['IN_PROGRESS', 'BLOCKED', 'TIMEOUT', 'FAILED', 'NEEDS-WORK'].includes(shard.status),
    ) ??
    detail.shards.find((shard) => shard.status === 'TODO') ??
    detail.shards[0]
  );
}

function getShardEvidence(detail: LoopDetail, shardId: string) {
  const implementations = detail.implementationRecords.filter(
    (record) => record.shardId === shardId,
  );
  const tests = detail.testRecords.filter((record) => record.shardId === shardId);
  const reviews = detail.reviewRecords.filter((record) => record.shardId === shardId);
  const latestTest = tests[0];
  const latestReview = reviews[0];
  return {
    implementations,
    tests,
    reviews,
    latestTest,
    latestReview,
  };
}

function getShardAutomationStep(status: string) {
  if (status === 'TODO' || status === 'NEEDS-WORK') return 'implement';
  if (status === 'IN_PROGRESS' || status === 'IMPLEMENTED') return 'testing';
  if (status === 'DONE') return 'done';
  if (status === 'FAILED' || status === 'BLOCKED' || status === 'TIMEOUT') return 'attention';
  return 'queued';
}

function buildExecutionStatus(detail: LoopDetail, runtime?: LoopAgentRuntimeResponse) {
  const runtimeAgent = runtime?.agents.find(
    (agent) =>
      agent.issueId === detail.issue.id || agent.href?.endsWith(`/loops/${detail.issue.id}`),
  );
  const inferredAgent = PHASE_OWNER[detail.state.phase] ?? 'codex';
  const agentId = runtimeAgent?.id.includes('claude')
    ? 'claude-code'
    : runtimeAgent?.id.includes('codex')
      ? 'codex'
      : inferredAgent;
  const runtimeMode = runtime?.runtimes?.find((item) => item.agent === agentId)?.selected?.mode;
  const latestEvent = detail.logs[0];

  return {
    agentId,
    agentLabel: runtimeAgent?.label ?? formatAgentName(agentId),
    agentStatus: runtimeAgent?.status,
    isRuntimeMatched: Boolean(runtimeAgent),
    runtimeMode,
    activeShard: getActiveShard(detail),
    latestEvent,
  };
}

function buildIssueExceptions(
  detail: LoopDetail,
  executionStatus: ReturnType<typeof buildExecutionStatus>,
  format: (key: string, values?: Record<string, string | number>) => string,
  locale?: string,
) {
  const items: Array<{
    id: string;
    reason: string;
    owner: string;
    action: string;
    evidence: string;
  }> = [];

  if (detail.state.paused) {
    items.push({
      id: 'paused',
      reason: format('exceptions.reasons.paused'),
      owner: format('exceptions.owners.operator'),
      action: format('exceptions.actions.resume'),
      evidence: `${formatLoopStatus(detail.state.phase, locale)} · ${format('exceptions.round', {
        round: detail.state.round,
      })}`,
    });
  }

  if (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS') {
    items.push({
      id: 'global-verdict',
      reason: format('exceptions.reasons.globalVerdict', {
        verdict: formatLoopSignal(detail.state.globalVerdict, locale),
      }),
      owner: format('exceptions.owners.reviewer'),
      action: format('exceptions.actions.reviewEvidence'),
      evidence: `${format('exceptions.round', { round: detail.state.round })} · ${
        detail.state.specVersion
      }`,
    });
  }

  if (detail.state.costCalls > 0 || detail.state.costTokens > 0 || detail.issue.priority === 'P0') {
    const evidence = `${format('stats.calls')}: ${detail.state.costCalls} · ${format(
      'stats.tokens',
    )}: ${detail.state.costTokens}`;
    if (detail.issue.priority === 'P0') {
      items.push({
        id: 'priority',
        reason: format('exceptions.reasons.priority', { priority: detail.issue.priority }),
        owner: format('exceptions.owners.product'),
        action: format('exceptions.actions.monitorBudget'),
        evidence,
      });
    }
  }

  return items.map((item) => ({
    ...item,
    runtimeEvidence: format('exceptions.runtimeEvidence', {
      agent: executionStatus.agentLabel,
      status: executionStatus.agentStatus
        ? formatLoopStatus(executionStatus.agentStatus, locale)
        : executionStatus.isRuntimeMatched
          ? format('execution.liveRuntime')
          : format('execution.inferredRuntime'),
    }),
  }));
}

export default function LoopIssueDetailPage() {
  const locale = useLocale();
  const t = useTranslations('loops.detail');
  const { issueId } = useParams<{ issueId: string }>();
  const detailQuery = useLoopIssue(issueId);
  const agentRuntimeQuery = useLoopsAgentRuntime();
  const deliveryEvidenceQuery = useLoopDeliveryEvidence(issueId);
  const detail = detailQuery.data?.body.data;
  const agentRuntime = agentRuntimeQuery.data?.body.data as LoopAgentRuntimeResponse | undefined;
  const deliveryEvidence = deliveryEvidenceQuery.data?.body.data;
  const ops = useFormState(issueId);

  if (!detail) {
    return (
      <main className="min-h-dvh bg-background px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-muted-foreground">
            {detailQuery.isLoading ? t('loading') : t('notFound')}
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
      label: t('artifacts.fallback.rawPayload'),
      kind: 'raw-payload',
      path: detail.issue.rawPayloadRef,
      status: 'present',
      summary: t('artifacts.fallback.rawSummary'),
    },
    {
      id: `${detail.issue.id}-issue`,
      label: t('artifacts.fallback.issueRecord'),
      kind: 'issue',
      path: `.loops/issues/${detail.issue.id}.json`,
      status: 'present',
      summary: t('artifacts.fallback.issueSummary', {
        priority: detail.issue.priority,
        status: formatLoopStatus(detail.issue.status, locale),
        count: detail.issue.acceptanceCriteria.length,
      }),
    },
    {
      id: `${detail.issue.id}-intake`,
      label: t('artifacts.fallback.intakeRecord'),
      kind: 'intake',
      path: `.loops/intakes/${detail.intake.id}.json`,
      status: 'present',
      summary: t('artifacts.fallback.intakeSummary', {
        status: formatLoopStatus(detail.intake.status, locale),
        channel: detail.intake.sourceChannel,
      }),
    },
  ];
  const learnings = detail.learnings ?? [];
  const traceTimeline = buildTraceTimeline(detail.logs, locale);
  const traceScopeSummary = buildTraceScopeSummary(detail.logs, locale);
  const resumeCheckpoints = buildResumeCheckpoints(detail, t, locale);
  const checkpointDiff = buildCheckpointDiff(detail, t);
  const currentRoundEvidenceArtifacts = filterCurrentRoundArtifacts(
    evidenceArtifacts,
    detail.state.round,
  );
  const artifactWorkspace = buildArtifactWorkspace(currentRoundEvidenceArtifacts);
  const historicalArtifactCount = evidenceArtifacts.length - currentRoundEvidenceArtifacts.length;
  const specDiffReview = buildSpecDiffReview(detail);
  const executionStatus = buildExecutionStatus(detail, agentRuntime);
  const issueExceptions = buildIssueExceptions(detail, executionStatus, t, locale);
  const hasDeliveryControls = Boolean(
    detail.workflowRecipe || detail.reviewGates?.length || detail.releaseGate,
  );
  const releaseChecklistEntries = detail.releaseGate
    ? (Object.entries(detail.releaseGate.checklist) as Array<
        [keyof typeof detail.releaseGate.checklist, boolean]
      >)
    : [];
  const currentRoundImplementationRecords = filterCurrentRound(
    detail.implementationRecords,
    detail.state.round,
  );
  const currentRoundReviewRecords = filterCurrentRound(detail.reviewRecords, detail.state.round);
  const currentRoundTestRecords = filterCurrentRound(detail.testRecords, detail.state.round);
  const currentRoundGlobalReview =
    detail.globalReview?.round === detail.state.round ? detail.globalReview : undefined;
  const historicalEvidenceCount =
    detail.implementationRecords.length -
    currentRoundImplementationRecords.length +
    detail.reviewRecords.length -
    currentRoundReviewRecords.length +
    detail.testRecords.length -
    currentRoundTestRecords.length +
    (detail.globalReview && detail.globalReview.round !== detail.state.round ? 1 : 0);
  const runStepBlocker = getRunStepBlocker(detail);
  const runnableShard = getRunnableShard(detail);
  const recoverableShard = getRecoverableShard(detail);
  const latestBrowserQa = detail.browserQaReports?.[0];
  const activePhaseIndex = Math.max(
    0,
    FLOW_PHASES.findIndex((phase) => phase === detail.state.phase),
  );
  const handoffTimeline = buildAgentHandoffTimeline(detail);

  return (
    <main className="min-h-dvh bg-muted/20 px-4 py-5 md:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-lg border bg-background">
          <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-5">
            <div className="min-w-0">
              <Link
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                href="/loops"
              >
                <ChevronLeft className="size-4" />
                {t('back')}
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge className="max-w-full truncate">{detail.issue.id}</StatusBadge>
                <StatusBadge>{formatLoopStatus(detail.issue.status, locale)}</StatusBadge>
                <StatusBadge>{formatLoopLabel(detail.state.phase, locale)}</StatusBadge>
                {detail.state.paused ? (
                  <StatusBadge className={actionToneClass('attention')}>
                    {t('stats.paused')}
                  </StatusBadge>
                ) : null}
              </div>
              <h1 className="mt-3 max-w-4xl text-balance text-2xl font-semibold md:text-3xl">
                {detail.issue.title}
              </h1>
              <p className="mt-2 max-w-5xl text-pretty text-sm leading-6 text-muted-foreground">
                {detail.issue.body}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              <MetricTile label={t('stats.round')} value={detail.state.round} />
              <MetricTile label={t('stats.spec')} value={detail.state.specVersion} />
              <MetricTile
                label={t('stats.shards')}
                value={`${detail.state.shardsDone}/${detail.state.shardsTotal}`}
              />
              <MetricTile label={t('stats.calls')} value={detail.state.costCalls} />
              <MetricTile label={t('stats.tokens')} value={detail.state.costTokens} />
              <MetricTile
                label={t('stats.paused')}
                value={detail.state.paused ? t('stats.yes') : t('stats.no')}
              />
            </div>
          </div>
        </header>

        <SectionCard
          icon={Bot}
          meta={
            handoffTimeline.currentPersona
              ? t('handoff.summary', {
                  current: DETAIL_PERSONA_LABELS[handoffTimeline.currentPersona],
                  next: handoffTimeline.nextPersona
                    ? DETAIL_PERSONA_LABELS[handoffTimeline.nextPersona]
                    : t('nextAction.closed.label'),
                })
              : t('handoff.noCurrent')
          }
          title={t('handoff.title')}
        >
          {handoffTimeline.blocked ? (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
              {t('handoff.blocked')}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-9">
            {handoffTimeline.steps.map((step) => {
              const isCurrent = step.state === 'current';
              return (
                <div
                  className={`rounded-md border p-2 text-xs ${deliveryStatusClass(
                    step.state === 'done'
                      ? 'passed'
                      : isCurrent
                        ? 'current'
                        : step.state === 'blocked'
                          ? 'blocked'
                          : step.state === 'next'
                            ? 'needs_changes'
                            : 'pending',
                  )}`}
                  key={step.persona}
                >
                  <p className="truncate font-medium">{DETAIL_PERSONA_LABELS[step.persona]}</p>
                  <p className="mt-1 truncate opacity-80">
                    {handoffBackendLabel(step.runtimeBackend)}
                    {step.humanGate ? ` · ${t('handoff.humanGate')}` : ''}
                  </p>
                  {step.evidence ? (
                    <p className="mt-1 truncate font-medium">{step.evidence}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          icon={Bot}
          meta={
            executionStatus.isRuntimeMatched
              ? t('execution.runtimeMatched')
              : t('execution.runtimeInferred')
          }
          title={t('execution.title')}
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile
                label={t('execution.currentPhase')}
                muted={formatLoopLabel(detail.state.phase, locale)}
                value={formatLoopStatus(detail.state.phase, locale)}
              />
              <MetricTile
                label={t('execution.currentAgent')}
                muted={
                  executionStatus.agentStatus
                    ? formatLoopStatus(executionStatus.agentStatus, locale)
                    : executionStatus.isRuntimeMatched
                      ? t('execution.liveRuntime')
                      : t('execution.inferredRuntime')
                }
                value={executionStatus.agentLabel}
              />
              <MetricTile
                label={t('execution.runtimeMode')}
                muted={agentRuntime?.workspaceId ?? t('execution.noWorkspace')}
                value={
                  executionStatus.runtimeMode
                    ? formatLoopLabel(executionStatus.runtimeMode, locale)
                    : t('execution.notReported')
                }
              />
              <MetricTile
                label={t('execution.activeShard')}
                muted={
                  executionStatus.activeShard
                    ? formatLoopStatus(executionStatus.activeShard.status, locale)
                    : t('execution.noShard')
                }
                value={executionStatus.activeShard?.title ?? t('execution.noShard')}
              />
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('execution.latestEvent')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {executionStatus.latestEvent
                      ? `${formatLoopEvent(executionStatus.latestEvent.type, locale)} · ${
                          executionStatus.latestEvent.ts
                        }`
                      : t('execution.noEvents')}
                  </p>
                </div>
                <StatusBadge>{formatLoopStatus(detail.issue.status, locale)}</StatusBadge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {FLOW_PHASES.map((phase, index) => {
                  const isDone = index < activePhaseIndex || detail.state.phase === 'CLOSED';
                  const isCurrent = index === activePhaseIndex && detail.state.phase !== 'CLOSED';
                  return (
                    <div
                      className={`rounded-md border p-2 text-xs ${
                        isCurrent
                          ? 'border-foreground bg-foreground text-background'
                          : isDone
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                            : 'bg-background text-muted-foreground'
                      }`}
                      key={phase}
                    >
                      <p className="truncate font-medium">{formatLoopStatus(phase, locale)}</p>
                      <p className="mt-1 truncate opacity-80">
                        {formatAgentName(PHASE_OWNER[phase])}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {hasDeliveryControls ? (
          <SectionCard
            icon={ShieldCheck}
            meta={t('deliveryControls.meta', {
              steps: detail.workflowRecipe?.steps.length ?? 0,
              gates: detail.reviewGates?.length ?? 0,
            })}
            title={t('deliveryControls.title')}
          >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t('deliveryControls.workflowTitle')}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detail.workflowRecipe?.name ?? t('deliveryControls.empty')}
                    </p>
                  </div>
                  {detail.workflowRecipe ? (
                    <StatusBadge>
                      {t('deliveryControls.workflowVersion', {
                        version: detail.workflowRecipe.version,
                      })}
                    </StatusBadge>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-4">
                  {detail.workflowRecipe?.steps.map((step) => (
                    <div
                      className={`rounded-md border p-3 text-xs ${deliveryStatusClass(step.status)}`}
                      key={step.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 font-medium">{step.label}</span>
                        <span className="shrink-0 rounded-md border bg-background/70 px-2 py-0.5">
                          {formatLoopStatus(step.status, locale)}
                        </span>
                      </div>
                      <p className="mt-2 truncate opacity-80">{formatAgentName(step.owner)}</p>
                      <p className="mt-1 truncate opacity-80">
                        {t('deliveryControls.gate', {
                          gate: formatLoopLabel(step.humanGate, locale),
                        })}
                      </p>
                      <p className="mt-2 truncate font-medium">
                        {t('deliveryControls.evidenceIds', {
                          count: step.evidenceIds.length,
                        })}
                      </p>
                      {step.blockedReason ? (
                        <p className="mt-2 line-clamp-2 rounded-md border bg-background/70 px-2 py-1">
                          {step.blockedReason}
                        </p>
                      ) : null}
                    </div>
                  )) ?? (
                    <p className="text-sm text-muted-foreground">{t('deliveryControls.empty')}</p>
                  )}
                </div>
                {detail.workflowRecipe?.baselineEvidence?.length ? (
                  <div className="mt-5">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      {t('deliveryControls.baselineTitle')}
                    </h4>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {detail.workflowRecipe.baselineEvidence.map((item) => (
                        <div className="rounded-md border bg-muted/20 p-3 text-xs" key={item.id}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 font-medium">{item.label}</span>
                            <span className="shrink-0 rounded-md border bg-background px-2 py-0.5">
                              {formatLoopLabel(item.kind, locale)}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-muted-foreground">{item.value}</p>
                          {item.evidenceRef ? (
                            <p className="mt-2 truncate font-medium">{item.evidenceRef}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div>
                  <h3 className="text-sm font-semibold">{t('deliveryControls.actionsTitle')}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <form
                      className="rounded-md border bg-muted/20 p-3 text-xs"
                      onSubmit={ops.runBrowserQa}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{t('deliveryControls.browserQa.title')}</span>
                        <StatusBadge
                          className={deliveryStatusClass(latestBrowserQa?.status ?? 'pending')}
                        >
                          {formatLoopStatus(latestBrowserQa?.status ?? 'pending', locale)}
                        </StatusBadge>
                      </div>
                      <label className="mt-3 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.targetUrl')}
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          name="targetUrl"
                          placeholder="https://example.com"
                          required
                          type="url"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.checkedFlows')}
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          defaultValue="page-load"
                          name="checkedFlows"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.viewports')}
                        </span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          defaultValue="desktop"
                          name="viewports"
                        >
                          <option value="desktop">
                            {t('deliveryControls.browserQa.viewportDesktop')}
                          </option>
                          <option value="tablet">
                            {t('deliveryControls.browserQa.viewportTablet')}
                          </option>
                          <option value="mobile">
                            {t('deliveryControls.browserQa.viewportMobile')}
                          </option>
                          <option value="all">{t('deliveryControls.browserQa.viewportAll')}</option>
                        </select>
                      </label>
                      <label className="mt-2 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.authSessionRef')}
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          name="authSessionRef"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.notes')}
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          name="notes"
                        />
                      </label>
                      <button
                        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        type="submit"
                      >
                        <Play className="size-4 shrink-0" />
                        <span className="truncate">{t('deliveryControls.browserQa.run')}</span>
                      </button>
                    </form>

                    {latestBrowserQa ? (
                      <div className="rounded-md border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {t('deliveryControls.browserQa.artifactsTitle')}
                          </span>
                          <StatusBadge className={deliveryStatusClass(latestBrowserQa.status)}>
                            {formatLoopStatus(latestBrowserQa.status, locale)}
                          </StatusBadge>
                        </div>
                        <p className="mt-2 truncate text-muted-foreground">
                          {latestBrowserQa.title ?? latestBrowserQa.targetUrl}
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <MetricTile
                            label={t('deliveryControls.browserQa.screenshots')}
                            value={latestBrowserQa.screenshots.length}
                          />
                          <MetricTile
                            label={t('deliveryControls.browserQa.traces')}
                            value={latestBrowserQa.traces?.length ?? 0}
                          />
                          <MetricTile
                            label={t('deliveryControls.browserQa.handoffs')}
                            value={latestBrowserQa.handoffs?.length ?? 0}
                          />
                        </div>
                        {latestBrowserQa.visualDiffs?.length ? (
                          <div className="mt-3 space-y-2">
                            <p className="font-medium">
                              {t('deliveryControls.browserQa.visualDiffs')}
                            </p>
                            {latestBrowserQa.visualDiffs.map((diff) => (
                              <div
                                className={`rounded-md border p-2 ${deliveryStatusClass(diff.status)}`}
                                key={`${diff.label}-${diff.actualPath}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="line-clamp-2 font-medium">{diff.label}</span>
                                  <span className="shrink-0 rounded-md border bg-background/70 px-2 py-0.5">
                                    {formatLoopStatus(diff.status, locale)}
                                  </span>
                                </div>
                                <p className="mt-1 truncate opacity-80">
                                  {diff.viewport
                                    ? `${diff.viewport.name} ${diff.viewport.width}x${diff.viewport.height}`
                                    : t('deliveryControls.browserQa.viewportUnknown')}
                                </p>
                                <p className="mt-1 truncate opacity-80">
                                  {t('deliveryControls.browserQa.changedPixels', {
                                    count: diff.changedPixels ?? 0,
                                  })}
                                </p>
                                <p className="mt-2 truncate font-medium">{diff.actualPath}</p>
                                {/* gstack P2: Embedded preview thumbnail */}
                                {diff.status === 'changed' && diff.diffPath ? (
                                  <div className="mt-2 grid grid-cols-2 gap-1">
                                    <img
                                      alt={`baseline: ${diff.label}`}
                                      className="w-full rounded border object-cover"
                                      src={getBrowserQaArtifactUrl(
                                        detail.issue.id,
                                        diff.baselinePath,
                                      )}
                                      style={{ maxHeight: 120 }}
                                    />
                                    <img
                                      alt={`diff: ${diff.label}`}
                                      className="w-full rounded border object-cover"
                                      src={getBrowserQaArtifactUrl(detail.issue.id, diff.diffPath)}
                                      style={{ maxHeight: 120 }}
                                    />
                                  </div>
                                ) : (
                                  <img
                                    alt={`screenshot: ${diff.label}`}
                                    className="mt-2 w-full rounded border object-cover"
                                    src={getBrowserQaArtifactUrl(detail.issue.id, diff.actualPath)}
                                    style={{ maxHeight: 120 }}
                                  />
                                )}
                                {diff.diffPath ? (
                                  <p className="mt-1 truncate opacity-80">{diff.diffPath}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {latestBrowserQa.handoffs?.length ? (
                          <div className="mt-3 space-y-1">
                            <p className="font-medium">
                              {t('deliveryControls.browserQa.handoffTitle')}
                            </p>
                            {latestBrowserQa.handoffs.map((handoff) => (
                              <p className="truncate text-muted-foreground" key={handoff.path}>
                                {handoff.label}: {handoff.path}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <form
                      className="rounded-md border bg-muted/20 p-3 text-xs"
                      onSubmit={ops.setBrowserQaSessionPolicy}
                    >
                      <span className="font-medium">
                        {t('deliveryControls.browserQa.sessionPolicy')}
                      </span>
                      <label className="mt-3 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.authMode')}
                        </span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          defaultValue={
                            detail.deliveryGovernance?.browserQaSessionPolicy?.authMode ?? 'none'
                          }
                          name="authMode"
                        >
                          <option value="none">none</option>
                          <option value="test-account">test-account</option>
                          <option value="manual-session">manual-session</option>
                        </select>
                      </label>
                      <label className="mt-2 block">
                        <span className="text-muted-foreground">
                          {t('deliveryControls.browserQa.testAccountRef')}
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                          defaultValue={
                            detail.deliveryGovernance?.browserQaSessionPolicy?.testAccountRef ?? ''
                          }
                          name="testAccountRef"
                        />
                      </label>
                      <button
                        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        type="submit"
                      >
                        {t('deliveryControls.browserQa.saveSessionPolicy')}
                      </button>
                    </form>

                    <form
                      className="rounded-md border bg-muted/20 p-3 text-xs"
                      onSubmit={ops.setRequiredReviewGates}
                    >
                      <span className="font-medium">
                        {t('deliveryControls.requiredReviewGates.title')}
                      </span>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(
                          [
                            'product',
                            'architecture',
                            'design',
                            'devex',
                            'security',
                            'code',
                          ] as const
                        ).map((kind) => (
                          <label
                            className="flex items-center gap-2 rounded-md border bg-background px-2 py-1"
                            key={kind}
                          >
                            <input
                              defaultChecked={
                                detail.deliveryGovernance?.requiredReviewGates?.gateKinds.includes(
                                  kind,
                                ) ?? detail.reviewGates?.some((gate) => gate.kind === kind)
                              }
                              name="gateKinds"
                              type="checkbox"
                              value={kind}
                            />
                            <span>{formatLoopLabel(kind, locale)}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        type="submit"
                      >
                        {t('deliveryControls.requiredReviewGates.save')}
                      </button>
                    </form>

                    <div className="rounded-md border bg-muted/20 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {t('deliveryControls.secondOpinionTitle')}
                        </span>
                        <StatusBadge
                          className={deliveryStatusClass(detail.secondOpinion?.status ?? 'pending')}
                        >
                          {formatLoopStatus(detail.secondOpinion?.status ?? 'pending', locale)}
                        </StatusBadge>
                      </div>
                      <button
                        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        onClick={ops.runSecondOpinion}
                        type="button"
                      >
                        <ClipboardCheck className="size-4 shrink-0" />
                        <span className="truncate">{t('deliveryControls.secondOpinion.run')}</span>
                      </button>
                      <button
                        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        onClick={ops.requireSecondOpinion}
                        type="button"
                      >
                        <ShieldCheck className="size-4 shrink-0" />
                        <span className="truncate">
                          {t('deliveryControls.secondOpinion.require')}
                        </span>
                      </button>
                    </div>

                    <form
                      className="rounded-md border bg-muted/20 p-3 text-xs"
                      onSubmit={ops.recordReleaseCanary}
                    >
                      <span className="font-medium">
                        {t('deliveryControls.releaseCanary.title')}
                      </span>
                      <select
                        className="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue={detail.deliveryGovernance?.releaseCanary?.status ?? 'pending'}
                        name="status"
                      >
                        <option value="pending">pending</option>
                        <option value="passed">passed</option>
                        <option value="failed">failed</option>
                      </select>
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue={detail.deliveryGovernance?.releaseCanary?.targetUrl ?? ''}
                        name="targetUrl"
                        placeholder={t('deliveryControls.releaseCanary.targetUrl')}
                        type="url"
                      />
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue={detail.deliveryGovernance?.releaseCanary?.environment ?? ''}
                        name="environment"
                        placeholder={t('deliveryControls.releaseCanary.environment')}
                      />
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue={
                          detail.deliveryGovernance?.releaseCanary?.environmentOwner ?? ''
                        }
                        name="environmentOwner"
                        placeholder={t('deliveryControls.releaseCanary.environmentOwner')}
                      />
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        name="reason"
                        placeholder={t('deliveryControls.releaseCanary.reason')}
                      />
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue={detail.deliveryGovernance?.releaseCanary?.rollbackNote ?? ''}
                        name="rollbackNote"
                        placeholder={t('deliveryControls.releaseCanary.rollbackNote')}
                      />
                      <button
                        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        type="submit"
                      >
                        {t('deliveryControls.releaseCanary.record')}
                      </button>
                    </form>

                    <form
                      className="rounded-md border bg-muted/20 p-3 text-xs"
                      onSubmit={ops.recordRuntimeOverride}
                    >
                      <span className="font-medium">
                        {t('deliveryControls.runtimeOverride.title')}
                      </span>
                      <select
                        className="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue="network"
                        name="scope"
                      >
                        <option value="network">network</option>
                        <option value="write">write</option>
                        <option value="shell">shell</option>
                      </select>
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        name="reason"
                        placeholder={t('deliveryControls.runtimeOverride.reason')}
                        required
                      />
                      <input
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                        name="expiresAt"
                        placeholder={t('deliveryControls.runtimeOverride.expiresAt')}
                      />
                      <button
                        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={ops.operations.isPending}
                        type="submit"
                      >
                        {t('deliveryControls.runtimeOverride.record')}
                      </button>
                    </form>

                    {detail.deliveryGovernance ? (
                      <div className="rounded-md border bg-muted/20 p-3 text-xs">
                        <p className="font-medium">{t('deliveryControls.governance.title')}</p>
                        <p className="mt-2 text-muted-foreground">
                          {t('deliveryControls.governance.browserQa', {
                            mode:
                              detail.deliveryGovernance.browserQaSessionPolicy?.authMode ?? 'none',
                          })}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {t('deliveryControls.governance.secondOpinion', {
                            required: String(
                              detail.deliveryGovernance.secondOpinionPolicy?.requiredForRelease ??
                                false,
                            ),
                          })}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {t('deliveryControls.governance.canary', {
                            status: detail.deliveryGovernance.releaseCanary?.status ?? 'not_run',
                          })}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {t('deliveryControls.governance.runtimeOverrides', {
                            count: detail.deliveryGovernance.runtimeOverrides.length,
                          })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">{t('deliveryControls.reviewTitle')}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {detail.reviewGates?.map((gate) => (
                      <div
                        className={`rounded-md border p-3 text-xs ${deliveryStatusClass(gate.status)}`}
                        key={gate.id}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{formatLoopLabel(gate.kind, locale)}</span>
                          <span className="rounded-md border bg-background/70 px-2 py-0.5">
                            {formatLoopStatus(gate.status, locale)}
                          </span>
                        </div>
                        <p className="mt-2 truncate opacity-80">
                          {t('deliveryControls.reviewer', {
                            reviewer: formatAgentName(gate.reviewer),
                          })}
                        </p>
                        <p className="mt-1 truncate opacity-80">
                          {t('deliveryControls.findings', { count: gate.findingsCount })}
                        </p>
                        {gate.waiverReason ? (
                          <p className="mt-2 line-clamp-2 rounded-md border bg-background/70 px-2 py-1">
                            {gate.waiverReason}
                          </p>
                        ) : null}
                      </div>
                    )) ?? (
                      <p className="text-sm text-muted-foreground">{t('deliveryControls.empty')}</p>
                    )}
                  </div>
                </div>

                {detail.secondOpinion ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">
                        {t('deliveryControls.secondOpinionTitle')}
                      </h3>
                      <StatusBadge className={deliveryStatusClass(detail.secondOpinion.status)}>
                        {formatLoopStatus(detail.secondOpinion.status, locale)}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 rounded-md border bg-muted/20 p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        {[detail.secondOpinion.primary, detail.secondOpinion.secondary].map(
                          (reviewer) => (
                            <div
                              className="rounded-md border bg-background p-3 text-xs"
                              key={reviewer.role}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {t(`deliveryControls.secondOpinionRoles.${reviewer.role}`)}
                                </span>
                                <span className="rounded-md border bg-muted/40 px-2 py-0.5">
                                  {formatLoopStatus(reviewer.status, locale)}
                                </span>
                              </div>
                              <p className="mt-2 truncate opacity-80">
                                {t('deliveryControls.reviewer', {
                                  reviewer: formatAgentName(reviewer.reviewer),
                                })}
                              </p>
                              <p className="mt-1 truncate opacity-80">
                                {t('deliveryControls.findings', {
                                  count: reviewer.findingsCount,
                                })}
                              </p>
                              {reviewer.summary ? (
                                <p className="mt-2 line-clamp-2 text-muted-foreground">
                                  {reviewer.summary}
                                </p>
                              ) : null}
                            </div>
                          ),
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <MetricTile
                          label={t('deliveryControls.secondOpinion.agreement')}
                          value={detail.secondOpinion.comparison.agreementCount}
                        />
                        <MetricTile
                          label={t('deliveryControls.secondOpinion.conflict')}
                          value={detail.secondOpinion.comparison.conflictCount}
                        />
                        <MetricTile
                          label={t('deliveryControls.secondOpinion.primaryOnly')}
                          value={detail.secondOpinion.comparison.primaryOnlyCount}
                        />
                        <MetricTile
                          label={t('deliveryControls.secondOpinion.secondaryOnly')}
                          value={detail.secondOpinion.comparison.secondaryOnlyCount}
                        />
                      </div>
                      {detail.secondOpinion.comparison.conflictCount > 0 ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-md border bg-background p-3 text-xs">
                            <p className="font-medium">
                              {t('deliveryControls.secondOpinion.conflictDrilldown')}
                            </p>
                            <ul className="mt-2 space-y-1 text-muted-foreground">
                              {detail.secondOpinion.comparison.conflictFingerprints.map(
                                (fingerprint) => (
                                  <li className="truncate" key={fingerprint}>
                                    {fingerprint}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-950 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100 disabled:opacity-50"
                              disabled={ops.operations.isPending}
                              onClick={() =>
                                ops.acceptPrimaryFindings(
                                  detail.secondOpinion?.comparison.conflictFingerprints,
                                )
                              }
                              type="button"
                            >
                              {t('deliveryControls.secondOpinion.acceptPrimaryBatch')}
                            </button>
                            <button
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-medium text-sky-950 hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/20 dark:text-sky-100 disabled:opacity-50"
                              disabled={ops.operations.isPending}
                              onClick={() =>
                                ops.acceptSecondaryFindings(
                                  detail.secondOpinion?.comparison.conflictFingerprints,
                                )
                              }
                              type="button"
                            >
                              {t('deliveryControls.secondOpinion.acceptSecondaryBatch')}
                            </button>
                            <button
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100 disabled:opacity-50"
                              disabled={ops.operations.isPending}
                              onClick={() =>
                                ops.waiveSecondOpinion(
                                  undefined,
                                  detail.secondOpinion?.comparison.conflictFingerprints,
                                )
                              }
                              type="button"
                            >
                              {t('deliveryControls.secondOpinion.waiveBatch')}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{t('deliveryControls.releaseTitle')}</h3>
                    {detail.releaseGate ? (
                      <StatusBadge className={deliveryStatusClass(detail.releaseGate.status)}>
                        {formatLoopStatus(detail.releaseGate.status, locale)}
                      </StatusBadge>
                    ) : null}
                  </div>
                  {detail.releaseGate ? (
                    <div className="mt-3 rounded-md border bg-muted/20 p-3">
                      {detail.releaseGate.blocker ? (
                        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
                          {detail.releaseGate.blocker}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {releaseChecklistEntries.map(([key, passed]) => (
                          <span
                            className={`rounded-md border px-2 py-1.5 text-xs ${
                              passed
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                                : 'bg-background text-muted-foreground'
                            }`}
                            key={key}
                          >
                            {t(`deliveryControls.releaseChecklist.${key}`)}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t('deliveryControls.evidenceIds', {
                          count: detail.releaseGate.evidenceIds.length,
                        })}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t('deliveryControls.empty')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-5">
            {detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS' ? (
              <SectionCard icon={RotateCcw} title={t('reloop.title')}>
                <p className="text-sm text-muted-foreground">
                  {t('reloop.body', {
                    verdict: formatLoopSignal(detail.state.globalVerdict, locale),
                  })}
                </p>
                <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={ops.reloop}>
                  <input
                    className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                    name="notes"
                    placeholder={t('reloop.placeholder')}
                  />
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted/40"
                    type="submit"
                  >
                    {t('reloop.start')}
                  </button>
                </form>
              </SectionCard>
            ) : null}

            <SectionCard icon={FileText} title={t('intake.title')}>
              <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md border bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{t('intake.submitter')}</dt>
                  <dd className="mt-1 font-medium">{detail.issue.submitterName}</dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{t('intake.source')}</dt>
                  <dd className="mt-1 font-medium">{detail.intake.sourceChannel}</dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-3 md:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t('intake.targetRepo')}</dt>
                  <dd className="mt-1 break-all font-medium">{detail.issue.targetRepo}</dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-3 md:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t('intake.rawPayload')}</dt>
                  <dd className="mt-1 break-all font-medium">{detail.issue.rawPayloadRef}</dd>
                </div>
                {detail.intake.ruleSnapshot ? (
                  <div className="rounded-md border bg-muted/20 p-3 md:col-span-2">
                    <dt className="text-xs text-muted-foreground">{t('intake.ruleSnapshot')}</dt>
                    <dd className="mt-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge>
                          {t('intake.ruleSnapshotMeta', {
                            present: detail.intake.ruleSnapshot.present,
                            total: detail.intake.ruleSnapshot.total,
                            status:
                              detail.intake.ruleSnapshot.enforcement.status === 'enforced'
                                ? t('intake.agentReadable')
                                : t('intake.notAgentReadable'),
                          })}
                        </StatusBadge>
                        <span className="text-xs text-muted-foreground">
                          {t('intake.ruleSnapshotCaptured', {
                            time: detail.intake.ruleSnapshot.capturedAt,
                          })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.intake.ruleSnapshot.rules.map((rule) => (
                          <span
                            className={`rounded-md border px-2 py-1 text-xs ${
                              rule.status === 'present'
                                ? 'bg-background text-foreground'
                                : 'text-muted-foreground'
                            }`}
                            key={rule.id}
                            title={rule.summary ?? rule.path}
                          >
                            {rule.label} · {rule.status}
                          </span>
                        ))}
                      </div>
                      {detail.intake.ruleSnapshot.diagnostics?.length ? (
                        <div className="space-y-1.5">
                          {detail.intake.ruleSnapshot.diagnostics.slice(0, 3).map((diagnostic) => (
                            <p
                              className="rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground"
                              key={diagnostic.id}
                            >
                              {diagnostic.message} · {diagnostic.evidence}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </SectionCard>

            <SectionCard
              icon={ClipboardCheck}
              meta={t('requirements.summary', {
                accepted: requirementsCoverage.summary.accepted,
                total: requirementsCoverage.summary.total,
                percent: requirementsCoverage.summary.percent,
              })}
              title={t('requirements.title')}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <StatusBadge
                  className={requirementStatusClass(
                    requirementsCoverage.summary.percent === 100 ? 'accepted' : 'missing',
                  )}
                >
                  {requirementsCoverage.summary.percent === 100
                    ? t('requirements.covered')
                    : t('requirements.needsWork')}
                </StatusBadge>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {requirementsCoverage.items.map((item) => (
                  <div className="rounded-md border p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-5">{item.criterion}</p>
                      <StatusBadge className={`shrink-0 ${requirementStatusClass(item.status)}`}>
                        {formatLoopStatus(item.status, locale)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('requirements.meta', {
                        spec: item.inSpec ? t('stats.yes') : t('stats.no'),
                        shards: item.shardIds.length,
                        tests: item.testIds.length,
                        reviews: item.reviewRecordIds.length,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard icon={ListChecks} title={t('specReview.title')}>
              {detail.spec ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge>{detail.spec.version}</StatusBadge>
                    <StatusBadge>{formatLoopStatus(detail.spec.status, locale)}</StatusBadge>
                  </div>
                  {specDiffReview ? (
                    <div className="mt-4 rounded-md border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{t('specReview.diffTitle')}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('specReview.diffMeta', {
                              from: specDiffReview.fromVersion,
                              to: specDiffReview.toVersion,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge>
                            {t('specReview.diffAdded', { count: specDiffReview.added })}
                          </StatusBadge>
                          <StatusBadge>
                            {t('specReview.diffRemoved', { count: specDiffReview.removed })}
                          </StatusBadge>
                          <StatusBadge>
                            {t('specReview.diffUnchanged', { count: specDiffReview.unchanged })}
                          </StatusBadge>
                        </div>
                      </div>
                      {specDiffReview.addedPreview.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('specReview.diffAddedPreview')}
                          </p>
                          <ul className="mt-2 space-y-1 text-sm">
                            {specDiffReview.addedPreview.map((line) => (
                              <li className="text-pretty" key={`added-${line}`}>
                                + {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {specDiffReview.removedPreview.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('specReview.diffRemovedPreview')}
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {specDiffReview.removedPreview.map((line) => (
                              <li className="text-pretty" key={`removed-${line}`}>
                                - {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-6">
                    {detail.spec.body}
                  </pre>
                  {detail.spec.status === 'DRAFT' ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                        onClick={ops.approveSpec}
                        type="button"
                      >
                        {t('specReview.approve')}
                      </button>
                      <form
                        className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
                        onSubmit={ops.requestRevision}
                      >
                        <input
                          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                          name="notes"
                          placeholder={t('specReview.revisionPlaceholder')}
                        />
                        <button
                          className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-muted/40"
                          type="submit"
                        >
                          {t('specReview.requestRevision')}
                        </button>
                      </form>
                    </div>
                  ) : detail.spec.status === 'REVISION_REQUESTED' ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {t('specReview.revisionNote')}
                    </p>
                  ) : detail.spec.status === 'APPROVED' ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {t('specReview.approvedNote')}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('specReview.empty')}</p>
              )}
            </SectionCard>

            <SectionCard
              icon={CircleDot}
              meta={`${detail.state.shardsDone}/${detail.state.shardsTotal}`}
              title={t('shards.title')}
            >
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                {detail.shards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('shards.empty')}</p>
                ) : (
                  detail.shards.map((shard) => {
                    const shardEvidence = getShardEvidence(detail, shard.id);
                    const automationStep = getShardAutomationStep(shard.status);
                    return (
                      <div className="rounded-md border bg-background p-4" key={shard.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-balance font-medium leading-5">{shard.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('shards.meta', {
                                context: shard.estContext,
                                depends: shard.dependsOn.length || 0,
                              })}
                            </p>
                          </div>
                          <StatusBadge>{formatLoopStatus(shard.status, locale)}</StatusBadge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <MetricTile
                            label={t('shards.evidence.implementation')}
                            value={shardEvidence.implementations.length}
                          />
                          <MetricTile
                            label={t('shards.evidence.tests')}
                            value={shardEvidence.tests.length}
                          />
                          <MetricTile
                            label={t('shards.evidence.reviews')}
                            value={shardEvidence.reviews.length}
                          />
                        </div>
                        <div className="mt-4 rounded-md border bg-muted/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {t(`shards.automation.${automationStep}.title`)}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {t(`shards.automation.${automationStep}.owner`)}
                            </span>
                          </div>
                          <p className="mt-2 text-pretty text-xs text-muted-foreground">
                            {t(`shards.automation.${automationStep}.body`)}
                          </p>
                          {shardEvidence.latestTest ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t('shards.latestTest', {
                                status: formatLoopStatus(shardEvidence.latestTest.status, locale),
                                round: shardEvidence.latestTest.round,
                              })}
                            </p>
                          ) : null}
                          {shardEvidence.latestReview ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('shards.latestReview', {
                                verdict: formatLoopSignal(
                                  shardEvidence.latestReview.verdict,
                                  locale,
                                ),
                                round: shardEvidence.latestReview.round,
                              })}
                            </p>
                          ) : null}
                        </div>
                        {shard.acceptance.length > 0 ? (
                          <ul className="mt-4 grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                            {shard.acceptance.slice(0, 3).map((item) => (
                              <li className="rounded-md bg-muted/30 px-3 py-2" key={item}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard icon={Archive} title={t('records.implementation')}>
              <div className="mb-4 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t('records.currentRoundSummary', {
                  round: detail.state.round,
                  hidden: historicalEvidenceCount,
                })}
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">{t('records.implementation')}</h3>
                  <div className="mt-3 flex flex-col gap-3">
                    {currentRoundImplementationRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('records.noImplementation')}
                      </p>
                    ) : (
                      currentRoundImplementationRecords.map((record) => (
                        <div className="rounded-md bg-muted/30 p-3" key={record.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium">{record.shardId}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatLoopStatus(record.status, locale)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs">{record.summary}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('records.filesRound', {
                              files: record.changedFiles.length,
                              round: record.round,
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">{t('records.review')}</h3>
                  <div className="mt-3 flex flex-col gap-3">
                    {currentRoundReviewRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('records.noReview')}</p>
                    ) : (
                      currentRoundReviewRecords.map((record) => (
                        <div className="rounded-md bg-muted/30 p-3" key={record.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium">{record.shardId}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatLoopSignal(record.verdict, locale)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs">{record.summary}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('records.issuesRound', {
                              issues: record.issues.length,
                              round: record.round,
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">{t('records.test')}</h3>
                  <div className="mt-3 flex flex-col gap-3">
                    {currentRoundTestRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('records.noTest')}</p>
                    ) : (
                      currentRoundTestRecords.map((record) => (
                        <div className="rounded-md bg-muted/30 p-3" key={record.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium">{record.shardId}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatLoopStatus(record.status, locale)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('records.commandsRound', {
                              commands: record.commands.length,
                              round: record.round,
                            })}
                          </p>
                          {record.coverage ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('records.coverage', {
                                lines: record.coverage.lines ?? '-',
                                branches: record.coverage.branches ?? '-',
                              })}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{t('records.globalReview')}</h3>
                    <span className="text-xs text-muted-foreground">
                      {currentRoundGlobalReview?.verdict
                        ? formatLoopSignal(currentRoundGlobalReview.verdict, locale)
                        : t('records.none')}
                    </span>
                  </div>
                  {currentRoundGlobalReview ? (
                    <div className="mt-3 text-sm">
                      <p>{currentRoundGlobalReview.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('records.roundCreated', {
                          round: currentRoundGlobalReview.round,
                          created: currentRoundGlobalReview.created,
                        })}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t('records.noGlobalReview')}
                    </p>
                  )}
                </div>
                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{t('records.convergencePr')}</h3>
                    <span className="text-xs text-muted-foreground">
                      {detail.convergencePr?.status
                        ? formatLoopStatus(detail.convergencePr.status, locale)
                        : t('records.none')}
                    </span>
                  </div>
                  {detail.convergencePr ? (
                    <div className="mt-3 text-sm">
                      <p className="font-medium">{detail.convergencePr.branch}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('records.commitsBase', {
                          commits: detail.convergencePr.commits.length,
                          base: detail.convergencePr.baseBranch,
                        })}
                      </p>
                      {detail.convergencePr.url ? (
                        <a
                          className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                          href={detail.convergencePr.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {t('records.openPr', {
                            provider: detail.convergencePr.provider ?? t('records.remote'),
                          })}
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t('records.noConvergencePr')}
                    </p>
                  )}
                </div>
                <div className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">{t('records.testMatrix')}</h3>
                  {detail.testMatrix ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="rounded-md bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">{detail.testMatrix.id}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatLoopStatus(detail.testMatrix.status, locale)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('records.requiredRegression', {
                            required: detail.testMatrix.requiredTests.length,
                            files: detail.testMatrix.regressionScope.length,
                          })}
                        </p>
                      </div>
                      {detail.testMatrix.requiredTests.slice(0, 4).map((test) => (
                        <div className="rounded-md bg-muted/30 p-3" key={test.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-xs font-medium">{test.title}</p>
                            <span className="text-xs text-muted-foreground">{test.level}</span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{test.shardId}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t('records.noTestMatrix')}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-md border p-4">
                <h3 className="text-sm font-semibold">{t('records.annotations')}</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {detail.annotations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('records.noAnnotations')}</p>
                  ) : (
                    detail.annotations.map((annotation) => (
                      <div className="rounded-md bg-muted/30 p-3" key={annotation.target}>
                        <p className="text-sm font-medium">{annotation.target}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatLoopStatus(annotation.implStatus, locale)} ·{' '}
                          {formatLoopStatus(annotation.testStatus, locale)} ·{' '}
                          {formatLoopSignal(annotation.verdict, locale)} ·{' '}
                          {formatLoopLabel(annotation.risk, locale)}
                        </p>
                        <p className="mt-2 text-xs">{annotation.notes}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </SectionCard>
          </div>

          <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-5 xl:self-start">
            {issueExceptions.length > 0 ? (
              <SectionCard icon={TriangleAlert} title={t('exceptions.title')}>
                <div className="flex flex-col gap-3">
                  {issueExceptions.map((item) => (
                    <div
                      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100"
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{item.reason}</p>
                        <StatusBadge className="border-amber-300 bg-background/60 text-amber-950 dark:border-amber-900 dark:text-amber-100">
                          {item.owner}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-sm">{item.action}</p>
                      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs">
                        <div className="rounded-md border bg-background/50 p-2">
                          <dt className="text-muted-foreground">{t('exceptions.evidence')}</dt>
                          <dd className="mt-1 font-medium">{item.evidence}</dd>
                        </div>
                        <div className="rounded-md border bg-background/50 p-2">
                          <dt className="text-muted-foreground">{t('exceptions.runtime')}</dt>
                          <dd className="mt-1 font-medium">{item.runtimeEvidence}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <div className={cn('rounded-lg border p-5', actionToneClass(nextAction.tone))}>
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background/60">
                  <Info className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('nextAction.title')}</p>
                  <h2 className="mt-1 text-balance text-xl font-semibold">
                    {t(`nextAction.${nextAction.key}.label`)}
                  </h2>
                  <p className="mt-2 text-pretty text-sm opacity-80">
                    {t(`nextAction.${nextAction.key}.body`)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <ActionButton
                  disabled={!canAdvanceLoop(detail) || ops.operations.isPending}
                  icon={Play}
                  onClick={ops.advanceLoop}
                  primary={canAdvanceLoop(detail)}
                >
                  {t('actions.advance')}
                </ActionButton>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton disabled={detail.state.paused} icon={Pause} onClick={ops.pauseLoop}>
                    {t('actions.pause')}
                  </ActionButton>
                  <ActionButton
                    disabled={!detail.state.paused}
                    icon={RotateCcw}
                    onClick={ops.resumeLoop}
                  >
                    {t('actions.resume')}
                  </ActionButton>
                </div>
              </div>
              {ops.operations.errorMessage ? (
                <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p className="text-pretty">{ops.operations.errorMessage}</p>
                </div>
              ) : detail.spec?.status === 'DRAFT' ? (
                <div className="mt-4 rounded-md border bg-background/60 p-3 text-sm">
                  {t('runDiagnostics.reviewSpec')}
                </div>
              ) : detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS' ? (
                <div className="mt-4 rounded-md border bg-background/60 p-3 text-sm">
                  {t('runDiagnostics.reloop')}
                </div>
              ) : runStepBlocker ? (
                <div className="mt-4 flex gap-2 rounded-md border bg-background/60 p-3 text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p className="text-pretty">
                    {t(`runDiagnostics.${runStepBlocker}`, {
                      shard: executionStatus.activeShard?.title ?? '',
                    })}
                  </p>
                </div>
              ) : runnableShard ? (
                <div className="mt-4 rounded-md border bg-background/60 p-3 text-sm">
                  {t('runDiagnostics.ready', { shard: runnableShard.title })}
                </div>
              ) : recoverableShard ? (
                <div className="mt-4 rounded-md border bg-background/60 p-3 text-sm">
                  {t('runDiagnostics.recovering', { shard: recoverableShard.title })}
                </div>
              ) : null}
            </div>

            <SectionCard
              icon={ShieldCheck}
              meta={t('evidence.summary', {
                shards: detail.shards.length,
                annotations: detail.annotations.length,
              })}
              title={t('evidence.title')}
            >
              <div className="grid grid-cols-2 gap-3">
                {evidence.map(([label, done, total]) => (
                  <MetricTile
                    key={label}
                    label={t(`evidence.${label}`)}
                    value={`${done}/${total}`}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              icon={GitPullRequest}
              meta={
                deliveryEvidence
                  ? deliveryEvidence.prReady
                    ? t('deliveryEvidence.prReady')
                    : t('deliveryEvidence.prNotReady')
                  : t('deliveryEvidence.loading')
              }
              title={t('deliveryEvidence.title')}
            >
              {!deliveryEvidence ? (
                <p className="text-sm text-muted-foreground">{t('deliveryEvidence.loading')}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-background p-2">
                        <p className="text-muted-foreground">
                          {t('deliveryEvidence.globalVerdict')}
                        </p>
                        <p className="mt-1 font-medium">{deliveryEvidence.globalVerdict}</p>
                      </div>
                      <div className="rounded-md bg-background p-2">
                        <p className="text-muted-foreground">{t('deliveryEvidence.spec')}</p>
                        <p className="mt-1 truncate font-medium">{deliveryEvidence.spec.summary}</p>
                      </div>
                      <div className="rounded-md bg-background p-2">
                        <p className="text-muted-foreground">
                          {t('deliveryEvidence.workPackages')}
                        </p>
                        <p className="mt-1 font-medium">
                          {t('deliveryEvidence.workPackageCount', {
                            count: deliveryEvidence.workPackages.length,
                          })}
                        </p>
                      </div>
                      <div className="rounded-md bg-background p-2">
                        <p className="text-muted-foreground">{t('deliveryEvidence.tests')}</p>
                        <p className="mt-1 font-medium">
                          {t('deliveryEvidence.testsSummary', deliveryEvidence.tests)}
                        </p>
                      </div>
                      <div className="rounded-md bg-background p-2">
                        <p className="text-muted-foreground">{t('deliveryEvidence.reviews')}</p>
                        <p className="mt-1 font-medium">
                          {t('deliveryEvidence.reviewsSummary', deliveryEvidence.reviews)}
                        </p>
                      </div>
                      <div className="rounded-md bg-background p-2">
                        <p className="text-muted-foreground">{t('deliveryEvidence.cost')}</p>
                        <p className="mt-1 font-medium">
                          {t('deliveryEvidence.costSummary', {
                            ...deliveryEvidence.cost,
                            budget: deliveryEvidence.cost.budget,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  {deliveryEvidence.risks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('deliveryEvidence.risks')}
                      </p>
                      {deliveryEvidence.risks.slice(0, 3).map((risk, index) => (
                        <div
                          className={`rounded-md border px-3 py-2 text-xs ${
                            risk.severity === 'critical'
                              ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100'
                              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                          }`}
                          key={`risk-${index}`}
                        >
                          {risk.description}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="rounded-md border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{t('deliveryEvidence.prStatus')}</span>
                      <span className="rounded-md border bg-background px-2 py-1">
                        {deliveryEvidence.prStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('deliveryEvidence.prComment')}
                    </p>
                    <pre className="mt-2 max-h-32 overflow-auto rounded-md border bg-background p-3 text-xs leading-5 whitespace-pre-wrap">
                      {deliveryEvidence.markdown.slice(0, 600)}
                    </pre>
                  </div>
                  {detail.convergencePr?.url ? (
                    <a
                      className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/30"
                      href={detail.convergencePr.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <GitPullRequest className="size-3" />
                      {t('deliveryEvidence.openPr')}
                    </a>
                  ) : null}
                </div>
              )}
            </SectionCard>

            {learnings.length > 0 ? (
              <SectionCard
                icon={Lightbulb}
                meta={t('learningMemory.summary', { count: learnings.length })}
                title={t('learningMemory.title')}
              >
                <div className="flex flex-col gap-3">
                  {learnings.map((learning) => (
                    <div className="rounded-md border bg-muted/20 p-3" key={learning.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge>{t(`learningMemory.kind.${learning.kind}`)}</StatusBadge>
                        <span className="text-xs text-muted-foreground">
                          {t('learningMemory.confidence', {
                            value: Math.round(learning.confidence * 100),
                          })}
                        </span>
                      </div>
                      <p className="mt-3 text-sm">{learning.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>
                          {t('learningMemory.evidence', {
                            count: learning.evidenceIds.length,
                          })}
                        </span>
                        {learning.repo ? (
                          <span className="max-w-full truncate">{learning.repo}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard
              icon={RotateCcw}
              meta={t('resumeCheckpoints.count', { count: resumeCheckpoints.length })}
              title={t('resumeCheckpoints.title')}
            >
              <div className="rounded-md border bg-muted/20 p-3">
                <h3 className="text-sm font-medium">{t('resumeCheckpoints.diff')}</h3>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {checkpointDiff.map((item) => (
                    <div className="rounded-md bg-background p-3 text-xs" key={item.label}>
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-1 text-muted-foreground">
                        {t('resumeCheckpoints.to', {
                          before: item.before,
                          after: item.after,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {resumeCheckpoints.map((checkpoint) => (
                  <div className="rounded-md border p-3" key={checkpoint.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{checkpoint.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{checkpoint.meta}</p>
                      </div>
                      <StatusBadge>{checkpoint.status}</StatusBadge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {checkpoint.action}
                      {checkpoint.lastSignal ? ` · ${checkpoint.lastSignal}` : ''}
                      {checkpoint.lastEvent
                        ? ` · ${t('resumeCheckpoints.lastEvent', { time: checkpoint.lastEvent })}`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              icon={GitPullRequest}
              meta={t('records.present', {
                present: currentRoundEvidenceArtifacts.filter((item) => item.status === 'present')
                  .length,
                total: currentRoundEvidenceArtifacts.length,
              })}
              title={t('records.artifacts')}
            >
              <div className="mb-4 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t('records.currentRoundArtifactsSummary', {
                  round: detail.state.round,
                  hidden: historicalArtifactCount,
                })}
              </div>
              <div className="flex flex-col gap-4">
                {artifactWorkspace.map(({ group, artifacts }) => (
                  <div className="rounded-md border p-3" key={group}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">{t(`artifacts.groups.${group}`)}</h3>
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
                            <span className="text-xs text-muted-foreground">
                              {formatLoopStatus(artifact.status, locale)}
                            </span>
                          </div>
                          <p className="mt-2 break-all text-xs text-muted-foreground">
                            {formatLoopLabel(artifact.kind, locale)} · {artifact.path}
                            {artifact.count !== undefined ? ` · ${artifact.count}` : ''}
                          </p>
                          {artifact.summary ? (
                            <p className="mt-2 text-xs text-foreground">{artifact.summary}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t(`artifacts.hints.${artifactRecoveryHintKey(artifact)}`)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
            <div className="rounded-lg border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{t('trace.timeline')}</h2>
                <span className="text-xs text-muted-foreground">
                  {t('trace.events', { shown: traceTimeline.length, total: detail.logs.length })}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium">{t('trace.scopeSummary')}</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {traceScopeSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('trace.noScopes')}</p>
                  ) : (
                    traceScopeSummary.map((scope) => (
                      <div className="rounded-md border bg-muted/20 p-3" key={scope.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">{scope.id}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t('trace.scopeEvents', { count: scope.eventCount })}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {scope.lastTypeLabel}
                          {scope.signal ? ` · ${scope.signal}` : ''} ·{' '}
                          {t('trace.last', { time: scope.lastEvent })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {traceTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('trace.noEvents')}</p>
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
                            <p className="text-sm font-medium">{entry.typeLabel}</p>
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
              <h2 className="text-lg font-semibold">{t('eventLog.title')}</h2>
              <div className="mt-4 flex flex-col divide-y">
                {detail.logs.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{t('eventLog.empty')}</p>
                ) : (
                  detail.logs.slice(0, 12).map((entry, index) => (
                    <div
                      className="grid grid-cols-[120px_1fr] gap-3 py-3 text-xs"
                      key={`${entry.ts}-${entry.type}-${entry.shard ?? entry.issue ?? entry.loop ?? 'loop'}-${entry.status ?? entry.verdict ?? entry.action ?? 'event'}-${index}`}
                    >
                      <span className="text-muted-foreground">{entry.ts}</span>
                      <span>
                        <span className="font-medium">{formatLoopEvent(entry.type, locale)}</span>
                        <span className="ml-2 text-muted-foreground">
                          {entry.shard ??
                            formatLoopSignal(
                              entry.action ?? entry.status ?? entry.verdict ?? '',
                              locale,
                            )}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">{t('notifications.title')}</h2>
              <div className="mt-4 flex flex-col divide-y">
                {detail.notifications.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{t('notifications.empty')}</p>
                ) : (
                  detail.notifications.slice(0, 12).map((notification) => (
                    <div className="py-3 text-xs" key={notification.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">
                          {formatLoopLabel(notification.kind, locale)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatLoopStatus(notification.status, locale)}
                        </span>
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
