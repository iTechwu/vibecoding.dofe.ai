import type {
  LoopCostResponse,
  LoopListResponse,
  LoopMetricsActionItem,
  LoopNotification,
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

const HUMAN_ACTIONS = new Set<LoopMetricsActionItem['action']>([
  'review-spec',
  'resume',
  'reloop',
  'finalize',
]);

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
        priority:
          item.action === 'resume' || item.action === 'reloop'
            ? 'critical'
            : item.action === 'review-spec'
              ? 'warning'
              : 'info',
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

export function formatPhase(phase: string) {
  return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
}
