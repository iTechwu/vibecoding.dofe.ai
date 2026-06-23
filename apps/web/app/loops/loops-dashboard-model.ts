import type {
  LoopAgentToolRegistry,
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
  gateKind: ReviewGateKind;
  label: string;
  meta: string;
}

export interface ReviewInboxGroup {
  gateKind: ReviewGateKind;
  priority: RiskLevel;
  count: number;
  items: ReviewInboxItem[];
}

export type LoopBoardColumnId =
  | 'backlog'
  | 'specReview'
  | 'running'
  | 'blocked'
  | 'readyToShip'
  | 'delivered';

export interface LoopBoardItem {
  id: string;
  title: string;
  href: string;
  priority: string;
  mode: 'Plan' | 'Code' | 'Review' | 'Recovery' | 'Delivered';
  humanGate: 'Spec review' | 'Exception' | 'Release' | 'None' | 'Done';
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

export type ExceptionSource =
  | 'cost'
  | 'pause'
  | 'review'
  | 'runtime'
  | 'runtime-security'
  | 'doctor';

export interface ExceptionCenterItem {
  id: string;
  title: string;
  href: string;
  level: RiskLevel;
  reason: string;
  owner: string;
  action: string;
  evidence: string;
  impact: string;
  retryAction: string;
  evidenceHref: string;
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

export type DashboardGuideStepId = 'create' | 'review' | 'exceptions' | 'evidence';
export type DashboardGuideStepState = 'done' | 'active' | 'pending';

export interface DashboardGuideStep {
  id: DashboardGuideStepId;
  state: DashboardGuideStepState;
  href: string;
}

export type PermissionProfileModeId = 'read' | 'write' | 'shell' | 'network' | 'approval';
export type PermissionProfileState = 'enabled' | 'restricted' | 'planned';

export interface PermissionProfileMode {
  id: PermissionProfileModeId;
  state: PermissionProfileState;
  evidence: string;
}

export interface PermissionProfile {
  summary: {
    agents: number;
    tools: number;
    activeTools: number;
    plannedCompatibility: number;
  };
  modes: PermissionProfileMode[];
}

export interface ProviderProfileItem {
  provider: string;
  agents: number;
  activeAgents: number;
  runtimeMode: string;
  plannedTools: number;
}

export interface ProviderProfile {
  summary: {
    providers: number;
    activeAgents: number;
    plannedTools: number;
  };
  items: ProviderProfileItem[];
}

export type RuntimeBackendStatus = 'ready' | 'degraded' | 'unavailable';

export interface RuntimeBackendItem {
  id: string;
  name: string;
  kind: 'codex-cli' | 'claude-code-cli';
  mode: string;
  status: RuntimeBackendStatus;
  supportedStages: string[];
  permissionProfile: string;
  workspacePolicy: string;
  costPolicy: string;
  fallbackPolicy: string;
  healthChecks: string[];
  evidence: string;
}

export interface RuntimeBackends {
  summary: {
    total: number;
    ready: number;
    degraded: number;
    unavailable: number;
  };
  items: RuntimeBackendItem[];
}

export interface PerformanceSnapshot {
  passRate: number;
  redoRate: number;
  averageCalls: number;
  averageTokens: number;
  traceEvents: number;
  recentEvents: number;
}

export type EvalCheckStatus = 'passed' | 'attention' | 'blocked';

export interface EvalCheck {
  id:
    | 'architecture-compliance'
    | 'delivery-readiness'
    | 'runtime-safety'
    | 'test-evidence'
    | 'cost-policy';
  status: EvalCheckStatus;
  hardGate: boolean;
  evidence: string;
}

export interface EvalPlan {
  summary: {
    total: number;
    passed: number;
    attention: number;
    blocked: number;
  };
  checks: EvalCheck[];
}

export interface TriggerPortfolioSource {
  id: string;
  count: number;
  latest: string;
}

export interface TriggerPortfolioRecentItem {
  id: string;
  title: string;
  href: string;
  source: string;
  repo: string;
  submittedBy: string;
  created: string;
}

export interface TriggerPortfolio {
  summary: {
    total: number;
    sources: number;
    repos: number;
  };
  sources: TriggerPortfolioSource[];
  recent: TriggerPortfolioRecentItem[];
}

export interface RepoContextPhase {
  phase: string;
  count: number;
}

export interface RepoContextRecentItem {
  id: string;
  title: string;
  href: string;
  status: string;
  phase: string;
}

export interface RepoContextItem {
  repo: string;
  issues: number;
  blocked: number;
  latest: string;
  phases: RepoContextPhase[];
  recent: RepoContextRecentItem[];
}

export interface RepoContextMap {
  summary: {
    repos: number;
    issues: number;
    blocked: number;
  };
  repos: RepoContextItem[];
}

export type WorkflowRecipeStepId =
  | 'intake'
  | 'plan'
  | 'build'
  | 'codeReview'
  | 'browserQa'
  | 'release'
  | 'reflect';
export type WorkflowRecipeStepState = 'done' | 'current' | 'waiting' | 'blocked';
export type WorkflowRecipeGate = 'none' | 'human' | 'agent' | 'release';

export interface WorkflowRecipeStep {
  id: WorkflowRecipeStepId;
  state: WorkflowRecipeStepState;
  gate: WorkflowRecipeGate;
  count: number;
  evidence: string;
}

export interface WorkflowRecipe {
  summary: {
    total: number;
    currentStep: WorkflowRecipeStepId;
    blocked: number;
    releaseReady: number;
  };
  steps: WorkflowRecipeStep[];
}

export type ReviewGateKind =
  | 'product'
  | 'architecture'
  | 'code'
  | 'security'
  | 'release'
  | 'exception';
export type ReviewGateStatus = 'passed' | 'pending' | 'needsChanges' | 'blocked';

export interface ReviewGateItem {
  kind: ReviewGateKind;
  status: ReviewGateStatus;
  count: number;
  evidence: string;
}

export interface ReviewGatePortfolio {
  summary: {
    total: number;
    passed: number;
    pending: number;
    blocked: number;
  };
  gates: ReviewGateItem[];
}

export type ReleaseReadinessState = 'ready' | 'attention' | 'blocked';

export interface ReleaseReadinessItem {
  id: string;
  title: string;
  href: string;
  state: ReleaseReadinessState;
  checklist: {
    spec: boolean;
    implementation: boolean;
    review: boolean;
    qa: boolean;
  };
  evidence: string;
}

export interface ReleaseReadiness {
  summary: {
    ready: number;
    attention: number;
    blocked: number;
  };
  items: ReleaseReadinessItem[];
}

const HUMAN_ACTIONS = new Set<LoopMetricsActionItem['action']>(['review-spec', 'reloop']);

function isHumanDecisionAction(item: LoopMetricsActionItem) {
  return item.nextActionCategory === 'decision' || HUMAN_ACTIONS.has(item.action);
}

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
    .filter((item) => isHumanDecisionAction(item))
    .map(
      (item): ReviewInboxItem => ({
        id: `action-${item.issueId}-${item.action}`,
        title: item.title,
        href: item.href,
        source: 'action',
        priority: item.action === 'reloop' ? 'critical' : 'warning',
        gateKind: inferReviewGateKind({
          action: item.action,
          label: item.label,
          phase: item.phase,
        }),
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
        gateKind: inferReviewGateKind({ kind: item.kind, label: item.title }),
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

export function buildReviewInboxGroups(items: ReviewInboxItem[]): ReviewInboxGroup[] {
  const priorityRank: Record<RiskLevel, number> = { critical: 0, warning: 1, info: 2 };
  const gateRank: Record<ReviewGateKind, number> = {
    exception: 0,
    product: 1,
    architecture: 2,
    code: 3,
    security: 4,
    release: 5,
  };
  const groups = new Map<ReviewGateKind, ReviewInboxItem[]>();

  for (const item of items) {
    groups.set(item.gateKind, [...(groups.get(item.gateKind) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([gateKind, groupItems]) => {
      const sortedItems = [...groupItems].sort(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title),
      );
      return {
        gateKind,
        priority: sortedItems[0]?.priority ?? 'info',
        count: sortedItems.length,
        items: sortedItems,
      } satisfies ReviewInboxGroup;
    })
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        gateRank[a.gateKind] - gateRank[b.gateKind],
    );
}

function inferReviewGateKind(input: {
  action?: string;
  kind?: LoopNotification['kind'];
  label?: string;
  phase?: string;
}): ReviewGateKind {
  if (
    input.kind === 'COST_GUARD_TRIPPED' ||
    input.kind === 'SHARD_REDO_LIMIT' ||
    input.kind === 'RELOOP_LIMIT' ||
    input.kind === 'CONTEXT_BUDGET_EXCEEDED' ||
    input.action === 'reloop'
  ) {
    return 'exception';
  }
  if (
    input.phase === 'PHASE_6_CONVERGE' ||
    input.phase === 'PHASE_7_GLOBAL_REVIEW' ||
    input.phase === 'PHASE_8_ANNOTATE'
  ) {
    return 'release';
  }

  const label = input.label?.toLowerCase() ?? '';
  if (label.includes('security')) return 'security';
  if (label.includes('architecture') || label.includes('design')) return 'architecture';
  if (label.includes('code') || label.includes('implementation')) return 'code';
  if (label.includes('release') || label.includes('ship') || label.includes('final')) {
    return 'release';
  }
  return 'product';
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
  if (isReadyToShipCandidate(item)) {
    return 'readyToShip' satisfies LoopBoardColumnId;
  }
  return 'running' satisfies LoopBoardColumnId;
}

function isReadyToShipCandidate(item: LoopListItem) {
  const phase = item.state?.phase;
  return (
    item.state?.globalVerdict === 'PASS' ||
    phase === 'PHASE_6_CONVERGE' ||
    phase === 'PHASE_7_GLOBAL_REVIEW' ||
    phase === 'PHASE_8_ANNOTATE'
  );
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
  if (isReadyToShipCandidate(item)) {
    return 'Release';
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
    { id: 'readyToShip', items: [] },
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
        item.issue.status === 'CLOSED' || item.state?.finalized
          ? 'Ready for audit'
          : isReadyToShipCandidate(item)
            ? 'Ready to ship'
            : 'Pending PR',
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
        impact: 'Loop is paused before more agent calls are allowed',
        retryAction: 'Raise cap or split scope, then continue the loop',
        evidenceHref: href,
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
        impact: 'Delivery is stopped until an operator resumes work',
        retryAction: 'Resume the loop after checking the latest checkpoint',
        evidenceHref: href,
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
        impact: 'Delivery cannot finalize until review findings are resolved',
        retryAction: 'Open issue evidence and start a re-loop if needed',
        evidenceHref: href,
        source: 'review',
      });
    }

    for (const runtimeSecurity of item.runtimeSecurityExceptions ?? []) {
      exceptions.push({
        id: runtimeSecurity.id,
        title: item.issue.title,
        href,
        level: runtimeSecurity.level,
        reason: runtimeSecurity.reason,
        owner: 'Runtime security',
        action: 'Review command evidence',
        evidence: runtimeSecurity.command ?? runtimeSecurity.evidence,
        impact: 'Test execution was blocked or redacted by runtime policy',
        retryAction: 'Adjust the command or split the work, then rerun tests',
        evidenceHref: href,
        source: 'runtime-security',
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
        impact: 'Agent runtime may be unable to pick up queued work',
        retryAction: 'Open runtime diagnostics and retry detection',
        evidenceHref: diagnostic.href,
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
        impact: 'Dashboard state may be stale or incomplete',
        retryAction: 'Run doctor after fixing the reported state problem',
        evidenceHref: '/loops',
        source: 'doctor',
      }),
    ) ?? [];

  const failed = items.filter(
    (item) =>
      item.state?.paused ||
      (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') ||
      (item.runtimeSecurityExceptions?.length ?? 0) > 0 ||
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

export function buildDashboardGuide(input: {
  totalIssues: number;
  reviewItems: number;
  exceptionItems: number;
  deliveredItems: number;
}): DashboardGuideStep[] {
  const hasIssues = input.totalIssues > 0;
  const hasReview = input.reviewItems > 0;
  const hasExceptions = input.exceptionItems > 0;
  const hasDelivered = input.deliveredItems > 0;

  return [
    {
      id: 'create',
      state: hasIssues ? 'done' : 'active',
      href: '/loops/new',
    },
    {
      id: 'review',
      state: hasReview ? 'active' : hasIssues ? 'done' : 'pending',
      href: '/loops',
    },
    {
      id: 'exceptions',
      state: hasExceptions ? 'active' : hasIssues ? 'done' : 'pending',
      href: '/loops',
    },
    {
      id: 'evidence',
      state: hasDelivered ? 'done' : hasIssues ? 'pending' : 'pending',
      href: '/loops',
    },
  ];
}

function countAgentsWithPermission(
  registry: LoopAgentToolRegistry,
  permission: LoopAgentToolRegistry['agents'][number]['permissions'][number],
) {
  return registry.agents.filter((agent) => agent.permissions.includes(permission)).length;
}

function countToolsWithPermission(
  registry: LoopAgentToolRegistry,
  permission: LoopAgentToolRegistry['tools'][number]['permissions'][number],
) {
  return registry.tools.filter((tool) => tool.permissions.includes(permission)).length;
}

export function buildPermissionProfile(registry?: LoopAgentToolRegistry): PermissionProfile {
  const agents = registry?.agents ?? [];
  const tools = registry?.tools ?? [];
  const safeRegistry: LoopAgentToolRegistry = registry ?? {
    agents: [],
    tools: [],
    compatibilityChecks: [],
  };
  const activeTools = tools.filter((tool) => tool.lifecycle === 'active').length;
  const plannedCompatibility = tools.filter(
    (tool) => tool.compatibility.thirdParty === 'planned',
  ).length;
  const readAgents = countAgentsWithPermission(safeRegistry, 'read-repo');
  const readTools = countToolsWithPermission(safeRegistry, 'read-repo');
  const writeAgents = countAgentsWithPermission(safeRegistry, 'write-repo');
  const writeTools = countToolsWithPermission(safeRegistry, 'write-repo');
  const testAgents = countAgentsWithPermission(safeRegistry, 'run-tests');
  const approvalAgents = countAgentsWithPermission(safeRegistry, 'human-approval-required');

  return {
    summary: {
      agents: agents.length,
      tools: tools.length,
      activeTools,
      plannedCompatibility,
    },
    modes: [
      {
        id: 'read',
        state: readAgents || readTools ? 'enabled' : 'planned',
        evidence: `${readAgents} agents · ${readTools} tools`,
      },
      {
        id: 'write',
        state: writeAgents || writeTools ? 'enabled' : 'planned',
        evidence: `${writeAgents} agents · ${writeTools} tools`,
      },
      {
        id: 'shell',
        state: testAgents ? 'restricted' : 'planned',
        evidence: testAgents ? `${testAgents} agents can run tests` : 'No shell/test permission',
      },
      {
        id: 'network',
        state: plannedCompatibility ? 'planned' : 'restricted',
        evidence: plannedCompatibility
          ? `${plannedCompatibility} third-party tool compatibilities planned`
          : 'No network/provider extension declared',
      },
      {
        id: 'approval',
        state: approvalAgents ? 'enabled' : 'planned',
        evidence: approvalAgents
          ? `${approvalAgents} agents require human approval`
          : 'No human approval gate declared',
      },
    ],
  };
}

export function buildProviderProfile(
  registry?: LoopAgentToolRegistry,
  runtime?: LoopAgentRuntimeResponse,
): ProviderProfile {
  const agents = registry?.agents ?? [];
  const tools = registry?.tools ?? [];
  const providerMap = new Map<
    string,
    {
      provider: string;
      agents: number;
      activeAgents: number;
      plannedTools: number;
    }
  >();

  for (const agent of agents) {
    const existing = providerMap.get(agent.provider) ?? {
      provider: agent.provider,
      agents: 0,
      activeAgents: 0,
      plannedTools: 0,
    };
    existing.agents += 1;
    if (agent.lifecycle === 'active') existing.activeAgents += 1;
    providerMap.set(agent.provider, existing);
  }

  for (const tool of tools) {
    if (tool.compatibility.codex) {
      const existing = providerMap.get('codex') ?? {
        provider: 'codex',
        agents: 0,
        activeAgents: 0,
        plannedTools: 0,
      };
      existing.plannedTools += tool.compatibility.thirdParty === 'planned' ? 1 : 0;
      providerMap.set('codex', existing);
    }
    if (tool.compatibility.claudeCode) {
      const existing = providerMap.get('claude-code') ?? {
        provider: 'claude-code',
        agents: 0,
        activeAgents: 0,
        plannedTools: 0,
      };
      existing.plannedTools += tool.compatibility.thirdParty === 'planned' ? 1 : 0;
      providerMap.set('claude-code', existing);
    }
  }

  const runtimeByProvider = new Map<string, string>(
    (runtime?.runtimes ?? []).map((item): [string, string] => [
      item.agent,
      item.selected?.mode ?? item.preferredMode ?? 'not reported',
    ]),
  );
  const items = [...providerMap.values()]
    .map((item) => ({
      ...item,
      runtimeMode: runtimeByProvider.get(item.provider) ?? 'not reported',
    }))
    .sort((a, b) => b.activeAgents - a.activeAgents || a.provider.localeCompare(b.provider));

  return {
    summary: {
      providers: items.length,
      activeAgents: items.reduce((sum, item) => sum + item.activeAgents, 0),
      plannedTools: items.reduce((sum, item) => sum + item.plannedTools, 0),
    },
    items,
  };
}

const RUNTIME_BACKEND_BLUEPRINTS: Record<
  'codex' | 'claude-code',
  Omit<RuntimeBackendItem, 'mode' | 'status' | 'healthChecks' | 'evidence'>
> = {
  codex: {
    id: 'runtime-backend-codex',
    name: 'Codex CLI',
    kind: 'codex-cli',
    supportedStages: ['Intake', 'Spec', 'Planning', 'Review', 'Release'],
    permissionProfile: 'read/review/test design; write only Loops artifacts',
    workspacePolicy: 'uses selected workspace profile and target repo scope',
    costPolicy: 'shares per-loop call/token guard',
    fallbackPolicy: 'Fallback to deterministic review gate',
  },
  'claude-code': {
    id: 'runtime-backend-claude-code',
    name: 'Claude Code CLI',
    kind: 'claude-code-cli',
    supportedStages: ['Implementation', 'Test execution', 'Second opinion'],
    permissionProfile: 'read/write/test within approved work package',
    workspacePolicy: 'requires approved workspace mount for Docker mode',
    costPolicy: 'shares per-loop call/token guard',
    fallbackPolicy: 'Pause and ask for runtime recovery',
  },
};

function runtimeBackendStatus(
  runtime: NonNullable<LoopAgentRuntimeResponse['runtimes']>[number],
): RuntimeBackendStatus {
  if (runtime.checks.some((check) => check.level === 'critical')) return 'unavailable';
  if (runtime.selected?.status === 'error' || runtime.selected?.status === 'misconfigured') {
    return 'unavailable';
  }
  if (runtime.checks.length > 0 || runtime.selected?.status === 'missing') return 'degraded';
  return runtime.selected?.status === 'ready' ? 'ready' : 'degraded';
}

export function buildRuntimeBackends(runtime?: LoopAgentRuntimeResponse): RuntimeBackends {
  const items = (runtime?.runtimes ?? [])
    .map((runtimeItem): RuntimeBackendItem => {
      const blueprint = RUNTIME_BACKEND_BLUEPRINTS[runtimeItem.agent];
      const selected = runtimeItem.selected ?? runtimeItem.docker ?? runtimeItem.local;
      return {
        ...blueprint,
        mode: selected?.mode ?? runtimeItem.preferredMode,
        status: runtimeBackendStatus(runtimeItem),
        healthChecks: runtimeItem.checks.map((check) => check.message),
        evidence: selected?.version ?? selected?.image ?? runtime?.workspaceId ?? 'detected',
      };
    })
    .sort((a, b) => {
      const rank: Record<RuntimeBackendStatus, number> = {
        unavailable: 0,
        degraded: 1,
        ready: 2,
      };
      return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
    });

  return {
    summary: {
      total: items.length,
      ready: items.filter((item) => item.status === 'ready').length,
      degraded: items.filter((item) => item.status === 'degraded').length,
      unavailable: items.filter((item) => item.status === 'unavailable').length,
    },
    items,
  };
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

export function buildPerformanceSnapshot(
  items: LoopListItem[],
  options: {
    cost?: LoopCostResponse;
    traceSummary?: { total: number; recent: number };
  } = {},
): PerformanceSnapshot {
  const completedOrReviewed = items.filter(
    (item) => item.issue.status === 'CLOSED' || item.state?.globalVerdict,
  );
  const passed = completedOrReviewed.filter(
    (item) =>
      item.issue.status === 'CLOSED' ||
      item.state?.finalized ||
      item.state?.globalVerdict === 'PASS',
  ).length;
  const redone = items.filter((item) => (item.state?.reloopCount ?? 0) > 0).length;
  const costLoops = options.cost?.loops ?? [];

  return {
    passRate: percent(passed, completedOrReviewed.length),
    redoRate: percent(redone, items.length),
    averageCalls: average(costLoops.map((item) => item.costCalls)),
    averageTokens: average(costLoops.map((item) => item.costTokens)),
    traceEvents: options.traceSummary?.total ?? 0,
    recentEvents: options.traceSummary?.recent ?? 0,
  };
}

function hasRuntimeSecurityException(item: LoopListItem) {
  return (item.runtimeSecurityExceptions?.length ?? 0) > 0;
}

export function buildEvalPlan(items: LoopListItem[], cost?: LoopCostResponse): EvalPlan {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const active = items.filter(
    ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
  );
  const blockedLoops = items.filter((item) => {
    const costItem = costByIssue.get(item.issue.id);
    return Boolean(
      item.state?.paused ||
      costItem?.tripped ||
      (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS'),
    );
  });
  const runtimeSecurityExceptions = items.reduce(
    (sum, item) => sum + (item.runtimeSecurityExceptions?.length ?? 0),
    0,
  );
  const failedEvidenceLoops = items.filter(
    (item) =>
      item.state?.globalVerdict === 'FAIL' ||
      item.runtimeSecurityExceptions?.some((exception) => exception.level === 'critical'),
  );
  const costTripped = cost?.loops.filter((item) => item.tripped).length ?? 0;

  const checks: EvalCheck[] = [
    {
      id: 'architecture-compliance',
      status: active.length > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: active.length
        ? `${active.length} active loops still need architecture/review evidence`
        : 'All active architecture gates are clear',
    },
    {
      id: 'delivery-readiness',
      status: blockedLoops.length > 0 ? 'blocked' : active.length > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: blockedLoops.length
        ? `${blockedLoops.length} loops blocked before release`
        : active.length
          ? `${active.length} loops still moving toward release`
          : 'No active delivery blockers',
    },
    {
      id: 'runtime-safety',
      status: runtimeSecurityExceptions > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: runtimeSecurityExceptions
        ? `${runtimeSecurityExceptions} runtime security exceptions recorded`
        : 'Runtime security policy has no recorded exceptions',
    },
    {
      id: 'test-evidence',
      status:
        failedEvidenceLoops.length > 0 ? 'blocked' : active.length > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: failedEvidenceLoops.length
        ? `${failedEvidenceLoops.length} loops failed global review or tests`
        : active.length
          ? `${active.length} loops still collecting test/review evidence`
          : 'All completed loops have passing evidence',
    },
    {
      id: 'cost-policy',
      status: costTripped > 0 ? 'blocked' : 'passed',
      hardGate: true,
      evidence: costTripped
        ? `${costTripped} loops tripped spend guard`
        : 'Spend guard is within policy',
    },
  ];

  return {
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.status === 'passed').length,
      attention: checks.filter((check) => check.status === 'attention').length,
      blocked: checks.filter((check) => check.status === 'blocked').length,
    },
    checks,
  };
}

export function buildTriggerPortfolio(items: LoopListItem[]): TriggerPortfolio {
  const sourceMap = new Map<string, TriggerPortfolioSource>();
  const repos = new Set<string>();

  for (const { issue } of items) {
    const source = `${issue.sourceChannel}/${issue.sourceKind}`;
    const previous = sourceMap.get(source);
    if (!previous || issue.created > previous.latest) {
      sourceMap.set(source, {
        id: source,
        count: (previous?.count ?? 0) + 1,
        latest: issue.created,
      });
    } else {
      previous.count += 1;
    }
    repos.add(issue.targetRepo);
  }

  return {
    summary: {
      total: items.length,
      sources: sourceMap.size,
      repos: repos.size,
    },
    sources: [...sourceMap.values()].sort(
      (a, b) => b.count - a.count || b.latest.localeCompare(a.latest) || a.id.localeCompare(b.id),
    ),
    recent: [...items]
      .sort((a, b) => b.issue.created.localeCompare(a.issue.created))
      .slice(0, 5)
      .map(({ issue }) => ({
        id: issue.id,
        title: issue.title,
        href: `/loops/${issue.id}`,
        source: `${issue.sourceChannel}/${issue.sourceKind}`,
        repo: issue.targetRepo,
        submittedBy: issue.submitterName || issue.submitterId,
        created: issue.created,
      })),
  };
}

export function buildRepoContextMap(
  items: LoopListItem[],
  cost?: LoopCostResponse,
): RepoContextMap {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const repoMap = new Map<
    string,
    {
      repo: string;
      issues: number;
      blocked: number;
      latest: string;
      phases: Map<string, number>;
      recent: Array<RepoContextRecentItem & { updated: string }>;
    }
  >();

  for (const item of items) {
    const { issue, state } = item;
    const repo = issue.targetRepo || 'unassigned';
    const phase = formatPhase(state?.phase ?? issue.status);
    const existing = repoMap.get(repo) ?? {
      repo,
      issues: 0,
      blocked: 0,
      latest: issue.updated,
      phases: new Map<string, number>(),
      recent: [],
    };
    const issueCost = costByIssue.get(issue.id);
    const blocked = Boolean(state?.paused || state?.globalVerdict === 'FAIL' || issueCost?.tripped);

    existing.issues += 1;
    existing.blocked += blocked ? 1 : 0;
    existing.latest = issue.updated > existing.latest ? issue.updated : existing.latest;
    existing.phases.set(phase, (existing.phases.get(phase) ?? 0) + 1);
    existing.recent.push({
      id: issue.id,
      title: issue.title,
      href: `/loops/${issue.id}`,
      status: issue.status,
      phase,
      updated: issue.updated,
    });
    repoMap.set(repo, existing);
  }

  const repos = [...repoMap.values()]
    .map((repo) => ({
      repo: repo.repo,
      issues: repo.issues,
      blocked: repo.blocked,
      latest: repo.latest,
      phases: [...repo.phases.entries()]
        .map(([phase, count]) => ({ phase, count }))
        .sort((a, b) => b.count - a.count || a.phase.localeCompare(b.phase)),
      recent: repo.recent
        .sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title))
        .slice(0, 3)
        .map(({ updated: _updated, ...item }) => item),
    }))
    .sort(
      (a, b) =>
        b.issues - a.issues || b.latest.localeCompare(a.latest) || a.repo.localeCompare(b.repo),
    );

  return {
    summary: {
      repos: repos.length,
      issues: items.length,
      blocked: repos.reduce((sum, repo) => sum + repo.blocked, 0),
    },
    repos,
  };
}

const WORKFLOW_RECIPE_STEPS: Array<{
  id: WorkflowRecipeStepId;
  phases: string[];
  gate: WorkflowRecipeGate;
}> = [
  { id: 'intake', phases: ['PHASE_0_INTAKE'], gate: 'none' },
  { id: 'plan', phases: ['PHASE_1_SPEC', 'PHASE_2_REVIEW', 'PHASE_3_DECOMPOSE'], gate: 'human' },
  { id: 'build', phases: ['PHASE_4_IMPLEMENT'], gate: 'agent' },
  { id: 'codeReview', phases: ['PHASE_5_REVIEW', 'PHASE_6_CONVERGE'], gate: 'agent' },
  { id: 'browserQa', phases: ['PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE'], gate: 'agent' },
  { id: 'release', phases: ['CLOSED'], gate: 'release' },
  { id: 'reflect', phases: ['ARCHIVED'], gate: 'none' },
];

const WORKFLOW_STEP_INDEX = new Map(
  WORKFLOW_RECIPE_STEPS.map((step, index) => [step.id, index] as const),
);

function workflowStepForItem(item: LoopListItem, costItem?: LoopCostResponse['loops'][number]) {
  if (
    item.state?.paused ||
    costItem?.tripped ||
    (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS')
  ) {
    return 'codeReview' satisfies WorkflowRecipeStepId;
  }
  if (item.issue.status === 'ARCHIVED') {
    return 'reflect' satisfies WorkflowRecipeStepId;
  }
  if (item.issue.status === 'CLOSED' || item.state?.phase === 'CLOSED' || item.state?.finalized) {
    return 'release' satisfies WorkflowRecipeStepId;
  }
  const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
  return (
    WORKFLOW_RECIPE_STEPS.find((step) => step.phases.includes(phase))?.id ??
    ('intake' satisfies WorkflowRecipeStepId)
  );
}

function workflowEvidence(
  step: (typeof WORKFLOW_RECIPE_STEPS)[number],
  count: number,
  blocked: number,
) {
  if (blocked > 0 && step.id === 'codeReview') {
    return `${blocked} blocked`;
  }
  if (count > 0) {
    return `${count} loops`;
  }
  if (step.id === 'browserQa') {
    return 'Browser QA gate planned';
  }
  if (step.id === 'release') {
    return 'Release gate planned';
  }
  return 'No loops';
}

export function buildWorkflowRecipe(
  items: LoopListItem[],
  cost?: LoopCostResponse,
): WorkflowRecipe {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const counts = new Map<WorkflowRecipeStepId, number>();
  let blocked = 0;
  let releaseReady = 0;

  for (const item of items) {
    const costItem = costByIssue.get(item.issue.id);
    const stepId = workflowStepForItem(item, costItem);
    counts.set(stepId, (counts.get(stepId) ?? 0) + 1);
    if (stepId === 'codeReview' && (item.state?.paused || costItem?.tripped)) blocked += 1;
    if (stepId === 'release') releaseReady += 1;
  }

  const activeStep =
    WORKFLOW_RECIPE_STEPS.find((step) => (counts.get(step.id) ?? 0) > 0)?.id ?? 'intake';
  const activeIndex = WORKFLOW_STEP_INDEX.get(activeStep) ?? 0;

  return {
    summary: {
      total: items.length,
      currentStep: activeStep,
      blocked,
      releaseReady,
    },
    steps: WORKFLOW_RECIPE_STEPS.map((step, index) => {
      const count = counts.get(step.id) ?? 0;
      const isBlocked = step.id === 'codeReview' && blocked > 0;
      return {
        id: step.id,
        state: isBlocked
          ? 'blocked'
          : count > 0
            ? 'current'
            : index < activeIndex
              ? 'done'
              : 'waiting',
        gate: step.gate,
        count,
        evidence: workflowEvidence(step, count, blocked),
      };
    }),
  };
}

export function buildReviewGatePortfolio(
  items: LoopListItem[],
  cost?: LoopCostResponse,
): ReviewGatePortfolio {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const activeItems = items.filter(({ issue }) => !['ARCHIVED', 'REJECTED'].includes(issue.status));
  const specPending = activeItems.filter(
    ({ state }) => !state || state.phase === 'PHASE_1_SPEC' || state.phase === 'PHASE_2_REVIEW',
  ).length;
  const architectureReady = activeItems.filter(({ state }) =>
    ['PHASE_3_DECOMPOSE', 'PHASE_4_IMPLEMENT', 'PHASE_5_REVIEW'].includes(
      state?.phase ?? 'PHASE_0_INTAKE',
    ),
  ).length;
  const codeNeedsChanges = activeItems.filter(
    ({ state }) => state?.globalVerdict && state.globalVerdict !== 'PASS',
  ).length;
  const blocked = activeItems.filter((item) => {
    const costItem = costByIssue.get(item.issue.id);
    return Boolean(item.state?.paused || costItem?.tripped);
  }).length;
  const closed = activeItems.filter(
    ({ issue, state }) =>
      issue.status === 'CLOSED' || state?.phase === 'CLOSED' || state?.finalized,
  ).length;

  const gates: ReviewGateItem[] = [
    {
      kind: 'product',
      status: specPending > 0 ? 'pending' : activeItems.length > 0 ? 'passed' : 'pending',
      count: specPending,
      evidence: specPending > 0 ? `${specPending} specs need decision` : 'Spec gate clear',
    },
    {
      kind: 'architecture',
      status: architectureReady > 0 || closed > 0 ? 'passed' : 'pending',
      count: architectureReady,
      evidence:
        architectureReady > 0
          ? `${architectureReady} loops decomposed or implemented`
          : 'Waiting for decomposition',
    },
    {
      kind: 'code',
      status: blocked > 0 ? 'blocked' : codeNeedsChanges > 0 ? 'needsChanges' : 'pending',
      count: codeNeedsChanges + blocked,
      evidence:
        blocked > 0
          ? `${blocked} blocked by exception`
          : codeNeedsChanges > 0
            ? `${codeNeedsChanges} reviews need changes`
            : 'Code review gate pending',
    },
    {
      kind: 'security',
      status: closed > 0 ? 'passed' : 'pending',
      count: closed,
      evidence:
        closed > 0 ? `${closed} delivered loops ready for audit` : 'Security review planned',
    },
  ];

  return {
    summary: {
      total: gates.length,
      passed: gates.filter((gate) => gate.status === 'passed').length,
      pending: gates.filter((gate) => gate.status === 'pending').length,
      blocked: gates.filter((gate) => ['blocked', 'needsChanges'].includes(gate.status)).length,
    },
    gates,
  };
}

export function buildReleaseReadiness(
  items: LoopListItem[],
  cost?: LoopCostResponse,
): ReleaseReadiness {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const releaseCandidates = items
    .filter(({ issue, state }) => {
      const phase = state?.phase ?? 'PHASE_0_INTAKE';
      return (
        issue.status === 'CLOSED' ||
        state?.finalized ||
        ['PHASE_6_CONVERGE', 'PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE', 'CLOSED'].includes(phase)
      );
    })
    .map((item): ReleaseReadinessItem => {
      const costItem = costByIssue.get(item.issue.id);
      const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
      const shardsDone = item.state?.shardsDone ?? 0;
      const shardsTotal = item.state?.shardsTotal ?? 0;
      const checklist = {
        spec: Boolean(item.state?.specVersion && item.state.specVersion !== 'v0'),
        implementation: shardsTotal > 0 && shardsDone >= shardsTotal,
        review: item.state?.globalVerdict === 'PASS' || item.issue.status === 'CLOSED',
        qa: ['PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE', 'CLOSED'].includes(phase),
      };
      const blocked = Boolean(item.state?.paused || costItem?.tripped);
      const ready = Object.values(checklist).every(Boolean) && !blocked;
      return {
        id: item.issue.id,
        title: item.issue.title,
        href: `/loops/${item.issue.id}`,
        state: blocked ? 'blocked' : ready ? 'ready' : 'attention',
        checklist,
        evidence: `${formatPhase(phase)} · ${shardsDone}/${shardsTotal} shards`,
      };
    })
    .sort((a, b) => {
      const rank: Record<ReleaseReadinessState, number> = { blocked: 0, attention: 1, ready: 2 };
      return rank[a.state] - rank[b.state] || a.title.localeCompare(b.title);
    })
    .slice(0, 6);

  return {
    summary: {
      ready: releaseCandidates.filter((item) => item.state === 'ready').length,
      attention: releaseCandidates.filter((item) => item.state === 'attention').length,
      blocked: releaseCandidates.filter((item) => item.state === 'blocked').length,
    },
    items: releaseCandidates,
  };
}

export function formatPhase(phase: string) {
  return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
}
