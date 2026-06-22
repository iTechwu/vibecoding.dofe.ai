import type {
  LoopAgentRuntimeResponse,
  LoopCostResponse,
  LoopListResponse,
  LoopMetricsActionItem,
  LoopNotification,
  LoopsDoctorResponse,
} from '@repo/contracts';
import { formatLoopStatus, formatLoopLabel } from './loops-display';

export type LoopListItem = LoopListResponse['list'][number];
export type RiskLevel = 'critical' | 'warning' | 'info';

export interface RiskItem {
  id: string;
  title: string;
  href: string;
  level: RiskLevel;
  reason: string;
  meta: string;
}

export interface AgingItem {
  id: string;
  title: string;
  href: string;
  level: RiskLevel;
  ageHours: number;
  phase: string;
  updated: string;
}

export interface ReviewInboxItem {
  id: string;
  title: string;
  href: string;
  source: 'action' | 'notification';
  priority: RiskLevel;
  label: string;
  meta: string;
}

export type LoopBoardColumnId = 'backlog' | 'specReview' | 'running' | 'blocked' | 'delivered';

export interface LoopBoardItem {
  id: string;
  title: string;
  href: string;
  priority: string;
  mode: 'Plan' | 'Code' | 'Review' | 'Recovery' | 'Delivered';
  humanGate: 'Spec review' | 'Exception' | 'None' | 'Done';
  evidence: string;
  gitRef: string;
  prState: string;
  blocker?: string;
  meta: string;
}

export interface LoopBoardColumn {
  id: LoopBoardColumnId;
  items: LoopBoardItem[];
}

export type ExceptionSource = 'cost' | 'pause' | 'review' | 'runtime' | 'doctor';

export interface ExceptionCenterItem {
  id: string;
  title: string;
  href: string;
  level: RiskLevel;
  reason: string;
  owner: string;
  action: string;
  evidence: string;
  source: ExceptionSource;
}

export interface ExceptionCenterCapacity {
  running: number;
  queued: number;
  attention: number;
  failed: number;
  capacity: number;
}

export interface ExceptionCenter {
  capacity: ExceptionCenterCapacity;
  items: ExceptionCenterItem[];
}

const HUMAN_ACTIONS = new Set<LoopMetricsActionItem['action']>(['review-spec', 'reloop']);

const HUMAN_NOTIFICATION_KINDS = new Set<LoopNotification['kind']>([
  'SPEC_REVIEW_REQUESTED',
  'HUMAN_INTERVENTION',
  'COST_GUARD_TRIPPED',
  'CONVERGENCE_READY',
  'SHARD_REDO_LIMIT',
  'RELOOP_LIMIT',
  'CONTEXT_BUDGET_EXCEEDED',
]);

export const AGING_QUEUE_SLA_POLICY = {
  warningHours: 24,
  criticalHours: 72,
  label: 'Warning at 24h stale; critical at 72h stale.',
} as const;

export const PHASE_LABELS: Record<string, string> = {
  PHASE_0_INTAKE: 'Intake',
  PHASE_1_SPEC: 'Spec',
  PHASE_2_REVIEW: 'Review',
  PHASE_3_DECOMPOSE: 'Decompose',
  PHASE_4_IMPLEMENT: 'Implement',
  PHASE_5_REVIEW: 'Shard Review',
  PHASE_6_CONVERGE: 'Converge',
  PHASE_7_GLOBAL_REVIEW: 'Global Review',
  PHASE_8_ANNOTATE: 'Annotate',
  CLOSED: 'Closed',
  PAUSED: 'Paused',
};

export function aggregateLoops(data?: LoopListResponse, cost?: LoopCostResponse) {
  const items = data?.list ?? [];
  const activeItems = items.filter(
    ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
  );
  const pausedItems = items.filter(({ state }) => state?.paused || state?.phase === 'PAUSED');
  const inLoopItems = items.filter(({ issue }) => issue.status === 'IN_LOOP');
  const closedItems = items.filter(({ issue }) => issue.status === 'CLOSED');
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const costTripped = cost?.loops.filter((item) => item.tripped) ?? [];
  const phaseCounts = items.reduce<Record<string, number>>((acc, item) => {
    const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
    acc[phase] = (acc[phase] ?? 0) + 1;
    return acc;
  }, {});
  const maxPhaseCount = Math.max(1, ...Object.values(phaseCounts));
  const minCallsRemaining = cost?.loops.length
    ? Math.min(...cost.loops.map((loop) => loop.callsRemaining))
    : 0;
  const minTokensRemaining = cost?.loops.length
    ? Math.min(...cost.loops.map((loop) => loop.tokensRemaining))
    : 0;
  const attentionCount =
    pausedItems.length +
    costTripped.length +
    items.filter(({ issue, state }) => issue.priority === 'P0' || state?.globalVerdict === 'FAIL')
      .length;

  return {
    items,
    active: activeItems.length,
    attention: attentionCount,
    closed: closedItems.length,
    costByIssue,
    costTripped,
    inLoop: inLoopItems.length,
    minCallsRemaining,
    minTokensRemaining,
    paused: pausedItems.length,
    phaseCounts,
    maxPhaseCount,
    total: data?.total ?? items.length,
  };
}

export function buildRiskQueue(items: LoopListItem[], cost?: LoopCostResponse): RiskItem[] {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  return items
    .flatMap((item): RiskItem[] => {
      const costItem = costByIssue.get(item.issue.id);
      const href = `/loops/${item.issue.id}`;
      const risks: RiskItem[] = [];
      if (item.state?.paused) {
        risks.push({
          id: `${item.issue.id}-paused`,
          title: item.issue.title,
          href,
          level: 'critical',
          reason: 'Paused',
          meta: item.state.phase,
        });
      }
      if (costItem?.tripped) {
        risks.push({
          id: `${item.issue.id}-cost`,
          title: item.issue.title,
          href,
          level: 'critical',
          reason: 'Cost guard tripped',
          meta: `${costItem.callsRemaining} calls remaining`,
        });
      }
      if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
        risks.push({
          id: `${item.issue.id}-verdict`,
          title: item.issue.title,
          href,
          level: 'warning',
          reason: 'Global review needs work',
          meta: `round ${item.state.round}`,
        });
      }
      if (item.issue.priority === 'P0' || item.issue.priority === 'P1') {
        risks.push({
          id: `${item.issue.id}-priority`,
          title: item.issue.title,
          href,
          level: item.issue.priority === 'P0' ? 'critical' : 'warning',
          reason: `${item.issue.priority} priority`,
          meta: item.issue.status,
        });
      }
      return risks;
    })
    .slice(0, 6);
}

export function buildAgingQueue(items: LoopListItem[], now = new Date()): AgingItem[] {
  const nowMs = now.getTime();
  return items
    .filter(({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status))
    .map((item) => {
      const updated = item.state?.updated ?? item.issue.updated;
      const updatedMs = new Date(updated).getTime();
      const ageHours = Number.isFinite(updatedMs)
        ? Math.max(0, Math.floor((nowMs - updatedMs) / 3_600_000))
        : 0;
      return {
        id: `${item.issue.id}-aging`,
        title: item.issue.title,
        href: `/loops/${item.issue.id}`,
        level:
          ageHours >= AGING_QUEUE_SLA_POLICY.criticalHours
            ? 'critical'
            : ageHours >= AGING_QUEUE_SLA_POLICY.warningHours
              ? 'warning'
              : 'info',
        ageHours,
        phase: item.state?.phase ?? 'PHASE_0_INTAKE',
        updated,
      } satisfies AgingItem;
    })
    .filter((item) => item.ageHours >= AGING_QUEUE_SLA_POLICY.warningHours)
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, 6);
}

export function buildReviewInbox(
  actions: LoopMetricsActionItem[],
  notifications: LoopNotification[] = [],
  locale?: string,
): ReviewInboxItem[] {
  const actionItems = actions
    .filter((item) => HUMAN_ACTIONS.has(item.action))
    .map(
      (item): ReviewInboxItem => ({
        id: `action-${item.issueId}-${item.action}`,
        title: item.title,
        href: item.href,
        source: 'action',
        priority: item.action === 'reloop' ? 'critical' : 'warning',
        label: item.label,
        meta: `${formatPhase(item.phase ?? 'PHASE_0_INTAKE')} · ${item.priority}`,
      }),
    );

  const notificationItems = notifications
    .filter((item) => HUMAN_NOTIFICATION_KINDS.has(item.kind))
    .map(
      (item): ReviewInboxItem => ({
        id: `notification-${item.id}`,
        title: item.title,
        href: item.actionHref ?? `/loops/${item.issueId}`,
        source: 'notification',
        priority:
          item.kind === 'COST_GUARD_TRIPPED' ||
          item.kind === 'SHARD_REDO_LIMIT' ||
          item.kind === 'RELOOP_LIMIT' ||
          item.kind === 'CONTEXT_BUDGET_EXCEEDED'
            ? 'critical'
            : 'warning',
        label: formatLoopLabel(item.kind, locale),
        meta: `${formatLoopStatus(item.status, locale)} · ${item.created}`,
      }),
    );

  const severityRank: Record<RiskLevel, number> = { critical: 0, warning: 1, info: 2 };
  return [...actionItems, ...notificationItems]
    .sort(
      (a, b) =>
        severityRank[a.priority] - severityRank[b.priority] || a.title.localeCompare(b.title),
    )
    .slice(0, 8);
}

function inferBoardColumn(item: LoopListItem, costItem?: LoopCostResponse['loops'][number]) {
  const { issue, state } = item;
  if (issue.status === 'CLOSED' || state?.phase === 'CLOSED' || state?.finalized) {
    return 'delivered' satisfies LoopBoardColumnId;
  }
  if (
    state?.paused ||
    costItem?.tripped ||
    (state?.globalVerdict && state.globalVerdict !== 'PASS')
  ) {
    return 'blocked' satisfies LoopBoardColumnId;
  }
  if (
    !state ||
    state.specVersion === 'v0' ||
    state.phase === 'PHASE_0_INTAKE' ||
    state.phase === 'PHASE_1_SPEC'
  ) {
    return 'backlog' satisfies LoopBoardColumnId;
  }
  if (state.phase === 'PHASE_2_REVIEW') {
    return 'specReview' satisfies LoopBoardColumnId;
  }
  return 'running' satisfies LoopBoardColumnId;
}

function inferMode(item: LoopListItem): LoopBoardItem['mode'] {
  const phase = item.state?.phase;
  if (item.issue.status === 'CLOSED' || phase === 'CLOSED' || item.state?.finalized) {
    return 'Delivered';
  }
  if (item.state?.paused || item.state?.globalVerdict === 'FAIL') {
    return 'Recovery';
  }
  if (phase === 'PHASE_0_INTAKE' || phase === 'PHASE_1_SPEC' || phase === 'PHASE_3_DECOMPOSE') {
    return 'Plan';
  }
  if (
    phase === 'PHASE_2_REVIEW' ||
    phase === 'PHASE_6_CONVERGE' ||
    phase === 'PHASE_7_GLOBAL_REVIEW'
  ) {
    return 'Review';
  }
  return 'Code';
}

function inferHumanGate(
  item: LoopListItem,
  costItem?: LoopCostResponse['loops'][number],
): LoopBoardItem['humanGate'] {
  if (item.issue.status === 'CLOSED' || item.state?.phase === 'CLOSED' || item.state?.finalized) {
    return 'Done';
  }
  if (
    item.state?.paused ||
    costItem?.tripped ||
    (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS')
  ) {
    return 'Exception';
  }
  if (item.state?.phase === 'PHASE_2_REVIEW') {
    return 'Spec review';
  }
  return 'None';
}

function inferBlocker(item: LoopListItem, costItem?: LoopCostResponse['loops'][number]) {
  if (costItem?.tripped) return 'Cost guard';
  if (item.state?.paused) return 'Paused';
  if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
    return `Global ${item.state.globalVerdict}`;
  }
  return undefined;
}

export function buildLoopBoard(items: LoopListItem[], cost?: LoopCostResponse): LoopBoardColumn[] {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const columns: LoopBoardColumn[] = [
    { id: 'backlog', items: [] },
    { id: 'specReview', items: [] },
    { id: 'running', items: [] },
    { id: 'blocked', items: [] },
    { id: 'delivered', items: [] },
  ];

  const columnById = new Map(columns.map((column) => [column.id, column]));
  for (const item of items) {
    const costItem = costByIssue.get(item.issue.id);
    const column = columnById.get(inferBoardColumn(item, costItem));
    if (!column) continue;
    const shardsDone = item.state?.shardsDone ?? 0;
    const shardsTotal = item.state?.shardsTotal ?? 0;
    const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
    column.items.push({
      id: item.issue.id,
      title: item.issue.title,
      href: `/loops/${item.issue.id}`,
      priority: item.issue.priority,
      mode: inferMode(item),
      humanGate: inferHumanGate(item, costItem),
      evidence: shardsTotal > 0 ? `${shardsDone}/${shardsTotal} shards` : 'No shards yet',
      gitRef: `loops/${item.issue.id}`,
      prState:
        item.issue.status === 'CLOSED' || item.state?.finalized ? 'Ready for audit' : 'Pending PR',
      blocker: inferBlocker(item, costItem),
      meta: `${formatPhase(phase)} · round ${item.state?.round ?? 0}`,
    });
  }

  for (const column of columns) {
    column.items.sort((a, b) => {
      const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 } as Record<string, number>;
      const aRank = priorityRank[a.priority] ?? 99;
      const bRank = priorityRank[b.priority] ?? 99;
      return aRank - bRank || a.title.localeCompare(b.title);
    });
  }
  return columns;
}

function exceptionSeverityRank(level: RiskLevel) {
  return { critical: 0, warning: 1, info: 2 }[level];
}

function countQueuedLoops(items: LoopListItem[]) {
  return items.filter(({ issue, state }) => {
    if (['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status)) return false;
    return !state || state.phase === 'PHASE_0_INTAKE' || state.phase === 'PHASE_1_SPEC';
  }).length;
}

export function buildExceptionCenter(
  items: LoopListItem[],
  options: {
    cost?: LoopCostResponse;
    runtime?: LoopAgentRuntimeResponse;
    health?: LoopsDoctorResponse;
  } = {},
): ExceptionCenter {
  const costByIssue = new Map((options.cost?.loops ?? []).map((item) => [item.issueId, item]));
  const loopItems = items.flatMap((item): ExceptionCenterItem[] => {
    const costItem = costByIssue.get(item.issue.id);
    const href = `/loops/${item.issue.id}`;
    const exceptions: ExceptionCenterItem[] = [];

    if (costItem?.tripped) {
      exceptions.push({
        id: `${item.issue.id}-cost`,
        title: item.issue.title,
        href,
        level: 'critical',
        reason: 'Cost guard tripped',
        owner: 'Product owner',
        action: 'Adjust budget or reduce scope',
        evidence: `${costItem.callsRemaining} calls · ${costItem.tokensRemaining} tokens remaining`,
        source: 'cost',
      });
    }

    if (item.state?.paused) {
      exceptions.push({
        id: `${item.issue.id}-paused`,
        title: item.issue.title,
        href,
        level: 'critical',
        reason: 'Paused',
        owner: 'Loop operator',
        action: 'Resume or assign recovery',
        evidence: `${formatPhase(item.state.phase)} · round ${item.state.round}`,
        source: 'pause',
      });
    }

    if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
      exceptions.push({
        id: `${item.issue.id}-global-verdict`,
        title: item.issue.title,
        href,
        level: item.state.globalVerdict === 'FAIL' ? 'warning' : 'info',
        reason: `Global ${item.state.globalVerdict}`,
        owner: 'Reviewer',
        action: 'Review failure evidence',
        evidence: `round ${item.state.round}`,
        source: 'review',
      });
    }

    return exceptions;
  });

  const runtimeItems =
    options.runtime?.diagnostics.map(
      (diagnostic): ExceptionCenterItem => ({
        id: `runtime-${diagnostic.id}`,
        title: diagnostic.title,
        href: diagnostic.href,
        level: diagnostic.level,
        reason: diagnostic.reason,
        owner: diagnostic.agentId,
        action: 'Open diagnostic',
        evidence: diagnostic.meta,
        source: 'runtime',
      }),
    ) ?? [];

  const doctorItems =
    options.health?.problems.map(
      (problem, index): ExceptionCenterItem => ({
        id: `doctor-${index}`,
        title: 'Runtime health',
        href: '/loops',
        level: 'warning',
        reason: problem,
        owner: 'Runtime owner',
        action: 'Run doctor or re-index',
        evidence: options.health?.root ?? 'Loops state',
        source: 'doctor',
      }),
    ) ?? [];

  const failed = items.filter(
    (item) =>
      item.state?.paused ||
      (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') ||
      costByIssue.get(item.issue.id)?.tripped,
  ).length;

  return {
    capacity: {
      running: options.runtime?.summary.running ?? 0,
      queued: countQueuedLoops(items),
      attention: options.runtime?.summary.attention ?? 0,
      failed,
      capacity: options.runtime?.summary.total ?? items.length,
    },
    items: [...loopItems, ...runtimeItems, ...doctorItems]
      .sort(
        (a, b) =>
          exceptionSeverityRank(a.level) - exceptionSeverityRank(b.level) ||
          a.title.localeCompare(b.title) ||
          a.reason.localeCompare(b.reason),
      )
      .slice(0, 8),
  };
}

export function formatPhase(phase: string) {
  return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
}
