import type { LoopCostResponse, LoopListResponse } from '@repo/contracts';

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
          reason: `Global ${item.state.globalVerdict}`,
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

export function formatPhase(phase: string) {
  return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
}
