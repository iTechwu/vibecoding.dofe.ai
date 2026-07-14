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

// ============================================================================
// i18n: 数据模型层无法调用 useTranslations()，因此所有面向展示的文案以
// `LocalizableText` 节点返回——`key` 是相对 `loops` 命名空间的点分路径，
// `params` 为可选插值（值可以是原始值，也可以是嵌套的 LocalizableText，
// 由 `tx()` 递归解析）。组件层用 `tx(node, t)` 渲染。
// ============================================================================
export interface LocalizableText {
  key: string;
  params?: Record<string, string | number | LocalizableText>;
}

export function L(
  key: string,
  params?: Record<string, string | number | LocalizableText>,
): LocalizableText {
  return params ? { key, params } : { key };
}

/** 把已经是最终文案（后端返回或已本地化）的字符串包装为节点，原样透传。 */
export function raw(value: string | number): LocalizableText {
  return L('dashboard.model.raw', { value });
}

/** 渲染助手：递归解析嵌套的 LocalizableText 参数后交给 next-intl 翻译。 */
export function tx(
  node: LocalizableText | undefined | null,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
): string {
  if (!node) return '';
  const params: Record<string, string | number | Date> | undefined =
    node.params &&
    (Object.fromEntries(
      Object.entries(node.params).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null && 'key' in v ? tx(v, t) : v,
      ]),
    ) as Record<string, string | number | Date>);
  return params ? t(node.key, params) : t(node.key);
}

const KNOWN_PHASES = new Set([
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
  'PAUSED',
]);

/** 把内部 phase 枚举映射为可本地化的阶段文案节点（复用既有 `dashboard.phaseLabels.*`）。 */
export function phaseL(phase: string | undefined | null): LocalizableText {
  const key = phase ?? '';
  return KNOWN_PHASES.has(key)
    ? L(`dashboard.phaseLabels.${key}`)
    : L('dashboard.model.raw', { value: key });
}

const STATUS_KEYS: Record<string, string> = {
  APPROVED: 'dashboard.model.statuses.approved',
  ARCHIVED: 'dashboard.model.statuses.archived',
  BLOCKED: 'dashboard.model.statuses.blocked',
  CLOSED: 'dashboard.model.statuses.closed',
  DRAFT: 'dashboard.model.statuses.draft',
  FAILED: 'dashboard.model.statuses.failed',
  FINALIZED: 'dashboard.model.statuses.finalized',
  IN_LOOP: 'dashboard.model.statuses.inLoop',
  IN_PROGRESS: 'dashboard.model.statuses.inProgress',
  OPEN: 'dashboard.model.statuses.open',
  PAUSED: 'dashboard.model.statuses.paused',
  PENDING: 'dashboard.model.statuses.pending',
  REJECTED: 'dashboard.model.statuses.rejected',
};

/** 把 loop 状态枚举映射为可本地化文案节点（无匹配时回退为原值字面量）。 */
export function statusL(status: string | undefined | null): LocalizableText {
  const key = STATUS_KEYS[status ?? ''];
  return key ? L(key) : L('dashboard.model.raw', { value: status ?? '' });
}

// ============================================================================
// Software Delivery Workforce (P0-1, 0623 · CrewAI gap 1).
// Maps the internal phase state machine to Crews/Personas so users read
// "who is doing what" without learning PHASE_4 / shards. Runtime execution
// still sits on Codex CLI / Claude Code CLI; personas are a product lens.
// ============================================================================
export type WorkforcePersonaId =
  | 'intake-analyst'
  | 'spec-writer'
  | 'human-gatekeeper'
  | 'work-planner'
  | 'builder'
  | 'test-runner'
  | 'code-reviewer'
  | 'release-reviewer'
  | 'evidence-curator';

export type WorkforcePersonaStatus = 'active' | 'idle' | 'blocked' | 'done';

export interface WorkforcePersonaPhase {
  phase: string;
  persona: WorkforcePersonaId;
}

export interface WorkforcePersona {
  id: WorkforcePersonaId;
  status: WorkforcePersonaStatus;
  count: number;
  phases: string[];
  runtimeBackend: 'codex-cli' | 'claude-code-cli' | 'human' | 'system';
  humanGate: boolean;
  activeIssueIds: string[];
}

export interface WorkforceOverview {
  summary: {
    total: number;
    active: number;
    idle: number;
    blocked: number;
    humanGates: number;
  };
  personas: WorkforcePersona[];
  activePersona: WorkforcePersonaId | null;
}

export type HandoffStepState = 'done' | 'current' | 'next' | 'waiting' | 'blocked';

export interface HandoffStep {
  persona: WorkforcePersonaId;
  phase: string;
  state: HandoffStepState;
  runtimeBackend: 'codex-cli' | 'claude-code-cli' | 'human' | 'system';
  humanGate: boolean;
  evidence: LocalizableText;
}

export interface AgentHandoffTimeline {
  currentPersona: WorkforcePersonaId | null;
  nextPersona: WorkforcePersonaId | null;
  blocked: boolean;
  steps: HandoffStep[];
}

/**
 * Ordered persona sequence and the phase(s) each persona owns. Derived from
 * the Loop phase enum so the workforce lens stays in sync with the scheduler.
 */
export const WORKFORCE_PERSONA_SEQUENCE: WorkforcePersonaId[] = [
  'intake-analyst',
  'spec-writer',
  'human-gatekeeper',
  'work-planner',
  'builder',
  'test-runner',
  'code-reviewer',
  'release-reviewer',
  'evidence-curator',
];

export const WORKFORCE_PERSONA_PHASES: Record<WorkforcePersonaId, string[]> = {
  'intake-analyst': ['PHASE_0_INTAKE'],
  'spec-writer': ['PHASE_1_SPEC'],
  'human-gatekeeper': ['PHASE_2_REVIEW'],
  'work-planner': ['PHASE_3_DECOMPOSE'],
  builder: ['PHASE_4_IMPLEMENT'],
  'test-runner': ['PHASE_5_REVIEW'],
  'code-reviewer': ['PHASE_6_CONVERGE'],
  'release-reviewer': ['PHASE_7_GLOBAL_REVIEW'],
  'evidence-curator': ['PHASE_8_ANNOTATE', 'CLOSED'],
};
const WORKFORCE_PERSONA_RUNTIME: Record<
  WorkforcePersonaId,
  'codex-cli' | 'claude-code-cli' | 'human' | 'system'
> = {
  'intake-analyst': 'system',
  'spec-writer': 'codex-cli',
  'human-gatekeeper': 'human',
  'work-planner': 'codex-cli',
  builder: 'claude-code-cli',
  'test-runner': 'codex-cli',
  'code-reviewer': 'codex-cli',
  'release-reviewer': 'codex-cli',
  'evidence-curator': 'codex-cli',
};

const WORKFORCE_PERSONA_HUMAN_GATE: Record<WorkforcePersonaId, boolean> = {
  'intake-analyst': false,
  'spec-writer': false,
  'human-gatekeeper': true,
  'work-planner': false,
  builder: false,
  'test-runner': false,
  'code-reviewer': false,
  'release-reviewer': false,
  'evidence-curator': false,
};

function personaForPhase(phase: string | undefined): WorkforcePersonaId {
  if (!phase) return 'intake-analyst';
  const entry = (
    Object.entries(WORKFORCE_PERSONA_PHASES) as Array<[WorkforcePersonaId, string[]]>
  ).find(([, phases]) => phases.includes(phase));
  return entry?.[0] ?? 'intake-analyst';
}

function issueSeverityForLoop(
  item: LoopListItem,
  costItem?: LoopCostResponse['loops'][number],
): WorkforcePersonaStatus {
  if (item.state?.paused || costItem?.tripped) return 'blocked';
  if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') return 'blocked';
  if (item.runtimeSecurityExceptions?.some((exception) => exception.level === 'critical') ?? false)
    return 'blocked';
  if (item.issue.status === 'CLOSED' || item.state?.finalized) return 'done';
  return 'active';
}

/**
 * Build the Workforce Overview: one persona per delivery role, with the
 * active/loop count and the phases that role owns. Reuses the existing loop
 * list + cost data so no backend schema change is required for v1.
 */
export function buildWorkforceOverview(
  items: LoopListItem[],
  cost?: LoopCostResponse,
): WorkforceOverview {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const counts = new Map<
    WorkforcePersonaId,
    {
      active: number;
      idle: number;
      blocked: number;
      done: number;
      phases: Set<string>;
      issueIds: string[];
    }
  >();
  for (const id of WORKFORCE_PERSONA_SEQUENCE) {
    counts.set(id, { active: 0, idle: 0, blocked: 0, done: 0, phases: new Set(), issueIds: [] });
  }

  let totalActive = 0;
  let totalBlocked = 0;
  let humanGates = 0;

  for (const item of items) {
    if (['ARCHIVED', 'REJECTED'].includes(item.issue.status)) continue;
    const phase = item.state?.phase ?? item.issue.status;
    const persona = personaForPhase(phase);
    const bucket = counts.get(persona);
    if (!bucket) continue;
    const costItem = costByIssue.get(item.issue.id);
    const severity = issueSeverityForLoop(item, costItem);
    bucket[severity] += 1;
    bucket.phases.add(phase);
    if (severity === 'active') totalActive += 1;
    if (severity === 'blocked') totalBlocked += 1;
    if (severity !== 'done') bucket.issueIds.push(item.issue.id);
  }

  const personas: WorkforcePersona[] = WORKFORCE_PERSONA_SEQUENCE.map((id) => {
    const bucket = counts.get(id)!;
    const status: WorkforcePersonaStatus =
      bucket.blocked > 0
        ? 'blocked'
        : bucket.active > 0
          ? 'active'
          : bucket.done > 0
            ? 'done'
            : 'idle';
    return {
      id,
      status,
      count: bucket.active + bucket.blocked + bucket.done,
      phases: [...bucket.phases],
      runtimeBackend: WORKFORCE_PERSONA_RUNTIME[id],
      humanGate: WORKFORCE_PERSONA_HUMAN_GATE[id],
      activeIssueIds: bucket.issueIds,
    };
  });

  const activePersona = personas.find((persona) => persona.status === 'active')?.id ?? null;
  const activeHumanGates = personas.filter(
    (persona) => persona.humanGate && persona.status === 'active',
  ).length;
  humanGates = activeHumanGates;

  return {
    summary: {
      total: personas.length,
      active: personas.filter((persona) => persona.status === 'active').length,
      idle: personas.filter((persona) => persona.status === 'idle').length,
      blocked: totalBlocked,
      humanGates,
    },
    personas,
    activePersona,
  };
}

/**
 * Build an Agent Handoff Timeline for a single loop detail. Shows the
 * sequential handoff between personas with current/next/blocked emphasis,
 * reusing the existing phase + verdict evidence so the detail page can render
 * "who is doing this now, who is next, where it stops" without backend changes.
 */
export function buildAgentHandoffTimeline(
  detail: {
    issue: { id: string; status: string };
    state: {
      phase?: string | undefined;
      paused?: boolean | undefined;
      finalized?: boolean | undefined;
      globalVerdict?: string | undefined;
      shardsTotal?: number | undefined;
      shardsDone?: number | undefined;
      round?: number | undefined;
    };
    shards?: { id: string; status: string }[];
    testRecords?: { id: string; status: string }[];
    reviewRecords?: { id: string; verdict: string }[];
  },
  costItem?: LoopCostResponse['loops'][number],
): AgentHandoffTimeline {
  const phase = detail.state.phase ?? detail.issue.status ?? 'PHASE_0_INTAKE';
  const blocked = Boolean(
    detail.state.paused ||
    costItem?.tripped ||
    (detail.state.globalVerdict && detail.state.globalVerdict !== 'PASS'),
  );
  const finalized = detail.issue.status === 'CLOSED' || detail.state.finalized === true;

  const steps: HandoffStep[] = WORKFORCE_PERSONA_SEQUENCE.map((persona): HandoffStep => {
    const phases = WORKFORCE_PERSONA_PHASES[persona];
    const ownsPhase = phases.includes(phase);
    const personaState: HandoffStepState = finalized
      ? 'done'
      : blocked && ownsPhase
        ? 'blocked'
        : ownsPhase
          ? 'current'
          : 'waiting';

    let evidence: LocalizableText = L('dashboard.model.evidence.empty');
    if (persona === 'builder' && detail.shards && detail.shards.length) {
      const done = detail.shards.filter((s) => s.status === 'DONE').length;
      evidence = L('dashboard.model.evidence.shards', { done, total: detail.shards.length });
    } else if (persona === 'test-runner' && detail.testRecords && detail.testRecords.length) {
      const passed = detail.testRecords.filter((t) => t.status === 'TEST-PASS').length;
      evidence = L('dashboard.model.evidence.tests', { passed, total: detail.testRecords.length });
    } else if (persona === 'code-reviewer' && detail.reviewRecords && detail.reviewRecords.length) {
      const passed = detail.reviewRecords.filter((r) => r.verdict === 'PASS').length;
      evidence = L('dashboard.model.evidence.reviews', {
        passed,
        total: detail.reviewRecords.length,
      });
    } else if (persona === 'evidence-curator') {
      evidence = finalized
        ? L('dashboard.model.delivery.curated')
        : L('dashboard.model.delivery.pendingFinalization');
    }

    return {
      persona,
      phase: phases[0] ?? phase,
      state: personaState,
      runtimeBackend: WORKFORCE_PERSONA_RUNTIME[persona],
      humanGate: WORKFORCE_PERSONA_HUMAN_GATE[persona],
      evidence,
    };
  });

  // Mark "next" persona (the one after current, if not blocked/finalized).
  if (!blocked && !finalized) {
    const currentIndex = steps.findIndex((step) => step.state === 'current');
    if (currentIndex >= 0 && currentIndex + 1 < steps.length) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep) nextStep.state = 'next';
    }
  }

  const currentPersona = steps.find((step) => step.state === 'current')?.persona ?? null;
  const nextPersona = steps.find((step) => step.state === 'next')?.persona ?? null;

  return {
    currentPersona,
    nextPersona,
    blocked,
    steps,
  };
}

export interface RiskItem {
  id: string;
  title: string;
  href: string;
  level: RiskLevel;
  reason: LocalizableText;
  meta: LocalizableText;
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
  label: LocalizableText;
  meta: LocalizableText;
  owner?: LocalizableText;
  slaHours?: number;
  ageHours?: number;
  evidence?: string;
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
  mode: LocalizableText;
  humanGate: LocalizableText;
  evidence: LocalizableText;
  gitRef: string;
  prState: LocalizableText;
  blocker?: LocalizableText;
  meta: LocalizableText;
}

export interface LoopBoardColumn {
  id: LoopBoardColumnId;
  items: LoopBoardItem[];
}

export type ExceptionSource =
  | 'cost'
  | 'eval'
  | 'pause'
  | 'review'
  | 'runtime'
  | 'runtime-security'
  | 'doctor';

export interface ExceptionCenterItem {
  id: string;
  title: LocalizableText;
  href: string;
  level: RiskLevel;
  reason: LocalizableText;
  owner: LocalizableText;
  action: LocalizableText;
  evidence: LocalizableText;
  impact: LocalizableText;
  retryAction: LocalizableText;
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

export type OperatorFocusKind = 'review' | 'exception' | 'continue' | 'create';

export interface OperatorFocusItem {
  kind: OperatorFocusKind;
  title: LocalizableText;
  href: string;
  label: LocalizableText;
  meta: LocalizableText;
  level: RiskLevel;
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
  evidence: LocalizableText;
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
  supportedStages: LocalizableText[];
  permissionProfile: LocalizableText;
  workspacePolicy: LocalizableText;
  costPolicy: LocalizableText;
  fallbackPolicy: LocalizableText;
  healthChecks: string[];
  evidence: LocalizableText;
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
  evidence: LocalizableText;
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
  phase: LocalizableText;
  count: number;
}

export interface RepoContextRecentItem {
  id: string;
  title: string;
  href: string;
  status: string;
  phase: LocalizableText;
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
  evidence: LocalizableText;
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
  evidence: LocalizableText;
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
  evidence: LocalizableText;
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
  label: L('dashboard.model.aging.slaPolicy', { warning: 24, critical: 72 }),
};

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
          reason: L('dashboard.model.reasons.paused'),
          meta: phaseL(item.state.phase),
        });
      }
      if (costItem?.tripped) {
        risks.push({
          id: `${item.issue.id}-cost`,
          title: item.issue.title,
          href,
          level: 'critical',
          reason: L('dashboard.model.reasons.costGuardTripped'),
          meta: L('dashboard.model.evidence.callsRemaining', { calls: costItem.callsRemaining }),
        });
      }
      if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
        risks.push({
          id: `${item.issue.id}-verdict`,
          title: item.issue.title,
          href,
          level: 'warning',
          reason: L('dashboard.model.reasons.globalReviewNeedsWork'),
          meta: L('dashboard.model.evidence.round', { round: item.state.round ?? 0 }),
        });
      }
      if (item.issue.priority === 'P0' || item.issue.priority === 'P1') {
        risks.push({
          id: `${item.issue.id}-priority`,
          title: item.issue.title,
          href,
          level: item.issue.priority === 'P0' ? 'critical' : 'warning',
          reason: L('dashboard.model.evidence.priority', { priority: item.issue.priority }),
          meta: statusL(item.issue.status),
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
        label: raw(item.label),
        meta: L('dashboard.model.meta.phasePriority', {
          phase: phaseL(item.phase ?? 'PHASE_0_INTAKE'),
          priority: item.priority,
        }),
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
        label: raw(formatLoopLabel(item.kind, locale)),
        meta: L('dashboard.model.meta.statusCreated', {
          status: raw(formatLoopStatus(item.status, locale)),
          created: item.created,
        }),
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

export function buildOperatorFocus(input: {
  reviewInbox: ReviewInboxItem[];
  exceptionItems: ExceptionCenterItem[];
  actionQueue: LoopMetricsActionItem[];
}): OperatorFocusItem {
  const topReview = input.reviewInbox[0];
  if (topReview) {
    return {
      kind: 'review',
      title: raw(topReview.title),
      href: topReview.href,
      label: topReview.label,
      meta: topReview.meta,
      level: topReview.priority,
    };
  }

  const topException = input.exceptionItems[0];
  if (topException) {
    return {
      kind: 'exception',
      title: topException.title,
      href: topException.href,
      label: topException.action,
      meta: L('dashboard.model.meta.ownerReason', {
        owner: topException.owner,
        reason: topException.reason,
      }),
      level: topException.level,
    };
  }

  const topAction = input.actionQueue[0];
  if (topAction) {
    return {
      kind: 'continue',
      title: raw(topAction.title),
      href: topAction.href,
      label: raw(topAction.label),
      meta: L('dashboard.model.meta.phasePriority', {
        phase: phaseL(topAction.phase ?? 'PHASE_0_INTAKE'),
        priority: topAction.priority,
      }),
      level: 'info',
    };
  }

  return {
    kind: 'create',
    title: raw(''),
    href: '/loops/new',
    label: raw(''),
    meta: raw(''),
    level: 'info',
  };
}

/**
 * gstack/0 P1-5: Detect second-opinion conflicts from per-loop release gate data.
 * A conflict is suspected when the release gate checklist shows
 * `secondOpinionPassed === false` for a loop that is in or past the convergence
 * phase (PHASE_6+). These items are surfaced in the Review Inbox under the
 * "release" gate kind with critical priority.
 */
export function buildSecondOpinionConflictItems(
  items: LoopListItem[],
  now = new Date(),
): ReviewInboxItem[] {
  const convergencePhases = ['PHASE_6_CONVERGE', 'PHASE_7_GLOBAL_REVIEW', 'PHASE_8_ANNOTATE'];
  const slaHours = 24;
  return items
    .filter(({ state, releaseGate }) => {
      const phase = state?.phase ?? 'PHASE_0_INTAKE';
      return (
        convergencePhases.includes(phase) && releaseGate?.checklist.secondOpinionPassed === false
      );
    })
    .map((item) => {
      const updated = item.state?.updated ?? item.issue.updated;
      const updatedMs = new Date(updated).getTime();
      const nowMs = now.getTime();
      const ageHours =
        Number.isFinite(updatedMs) && Number.isFinite(nowMs)
          ? Math.max(0, Math.floor((nowMs - updatedMs) / 3_600_000))
          : 0;
      const conflictCount = item.releaseGate?.checklist.secondOpinionPassed === false ? 1 : 0;
      return {
        id: `${item.issue.id}-second-opinion-conflict`,
        title: item.issue.title,
        href: `/loops/${item.issue.id}`,
        source: 'action' as const,
        priority: ageHours >= slaHours ? ('critical' as RiskLevel) : ('warning' as RiskLevel),
        gateKind: 'release' as ReviewGateKind,
        label: L('dashboard.model.review.secondOpinionConflict'),
        meta: L('dashboard.model.meta.secondOpinion', {
          phase: phaseL(item.state?.phase),
          conflicts: conflictCount,
          sla: slaHours,
        }),
        owner: L('dashboard.model.owners.releaseReviewer'),
        slaHours,
        ageHours,
        evidence: item.releaseGate?.blocker ?? item.releaseGate?.id,
      };
    });
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
    return L('dashboard.model.modes.delivered');
  }
  if (item.state?.paused || item.state?.globalVerdict === 'FAIL') {
    return L('dashboard.model.modes.recovery');
  }
  if (phase === 'PHASE_0_INTAKE' || phase === 'PHASE_1_SPEC' || phase === 'PHASE_3_DECOMPOSE') {
    return L('dashboard.model.modes.plan');
  }
  if (
    phase === 'PHASE_2_REVIEW' ||
    phase === 'PHASE_6_CONVERGE' ||
    phase === 'PHASE_7_GLOBAL_REVIEW'
  ) {
    return L('dashboard.model.modes.review');
  }
  return L('dashboard.model.modes.code');
}

function inferHumanGate(
  item: LoopListItem,
  costItem?: LoopCostResponse['loops'][number],
): LoopBoardItem['humanGate'] {
  if (item.issue.status === 'CLOSED' || item.state?.phase === 'CLOSED' || item.state?.finalized) {
    return L('dashboard.model.humanGates.done');
  }
  if (
    item.state?.paused ||
    costItem?.tripped ||
    (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS')
  ) {
    return L('dashboard.model.humanGates.exception');
  }
  if (item.state?.phase === 'PHASE_2_REVIEW') {
    return L('dashboard.model.humanGates.specReview');
  }
  if (isReadyToShipCandidate(item)) {
    return L('dashboard.model.humanGates.release');
  }
  return L('dashboard.model.humanGates.none');
}

function inferBlocker(
  item: LoopListItem,
  costItem?: LoopCostResponse['loops'][number],
): LocalizableText | undefined {
  if (costItem?.tripped) return L('dashboard.model.reasons.costGuard');
  if (item.state?.paused) return L('dashboard.model.reasons.paused');
  if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
    return L('dashboard.model.reasons.globalVerdict', { verdict: item.state.globalVerdict });
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
      evidence:
        shardsTotal > 0
          ? L('dashboard.model.evidence.shards', { done: shardsDone, total: shardsTotal })
          : L('dashboard.model.evidence.noShards'),
      gitRef: `loops/${item.issue.id}`,
      prState:
        item.issue.status === 'CLOSED' || item.state?.finalized
          ? L('dashboard.model.prState.readyForAudit')
          : isReadyToShipCandidate(item)
            ? L('dashboard.model.prState.readyToShip')
            : L('dashboard.model.prState.pendingPr'),
      blocker: inferBlocker(item, costItem),
      meta: L('dashboard.model.meta.phaseRound', {
        phase: phaseL(phase),
        round: item.state?.round ?? 0,
      }),
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
    evalPlan?: EvalPlan;
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
        title: raw(item.issue.title),
        href,
        level: 'critical',
        reason: L('dashboard.model.reasons.costGuardTripped'),
        owner: L('dashboard.model.owners.productOwner'),
        action: L('dashboard.model.actions.adjustBudget'),
        evidence: L('dashboard.model.evidence.callsTokensRemaining', {
          calls: costItem.callsRemaining,
          tokens: costItem.tokensRemaining,
        }),
        impact: L('dashboard.model.impact.costGuard'),
        retryAction: L('dashboard.model.retryAction.costGuard'),
        evidenceHref: href,
        source: 'cost',
      });
    }

    if (item.state?.paused) {
      exceptions.push({
        id: `${item.issue.id}-paused`,
        title: raw(item.issue.title),
        href,
        level: 'critical',
        reason: L('dashboard.model.reasons.paused'),
        owner: L('dashboard.model.owners.loopOperator'),
        action: L('dashboard.model.actions.resumeRecovery'),
        evidence: L('dashboard.model.meta.phaseRound', {
          phase: phaseL(item.state.phase),
          round: item.state.round ?? 0,
        }),
        impact: L('dashboard.model.impact.paused'),
        retryAction: L('dashboard.model.retryAction.paused'),
        evidenceHref: href,
        source: 'pause',
      });
    }

    if (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') {
      exceptions.push({
        id: `${item.issue.id}-global-verdict`,
        title: raw(item.issue.title),
        href,
        level: item.state.globalVerdict === 'FAIL' ? 'warning' : 'info',
        reason: L('dashboard.model.reasons.globalVerdict', { verdict: item.state.globalVerdict }),
        owner: L('dashboard.model.owners.reviewer'),
        action: L('dashboard.model.actions.reviewFailure'),
        evidence: L('dashboard.model.evidence.round', { round: item.state.round ?? 0 }),
        impact: L('dashboard.model.impact.globalVerdict'),
        retryAction: L('dashboard.model.retryAction.globalVerdict'),
        evidenceHref: href,
        source: 'review',
      });
    }

    for (const runtimeSecurity of item.runtimeSecurityExceptions ?? []) {
      exceptions.push({
        id: runtimeSecurity.id,
        title: raw(item.issue.title),
        href,
        level: runtimeSecurity.level,
        reason: raw(runtimeSecurity.reason),
        owner: L('dashboard.model.owners.runtimeSecurity'),
        action: L('dashboard.model.actions.reviewCommand'),
        evidence: raw(runtimeSecurity.command ?? runtimeSecurity.evidence),
        impact: L('dashboard.model.impact.runtimeSecurity'),
        retryAction: L('dashboard.model.retryAction.runtimeSecurity'),
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
        title: raw(diagnostic.title),
        href: diagnostic.href,
        level: diagnostic.level,
        reason: raw(diagnostic.reason),
        owner: raw(diagnostic.agentId),
        action: L('dashboard.model.actions.openDiagnostic'),
        evidence: raw(diagnostic.meta),
        impact: L('dashboard.model.impact.runtime'),
        retryAction: L('dashboard.model.retryAction.runtime'),
        evidenceHref: diagnostic.href,
        source: 'runtime',
      }),
    ) ?? [];

  const doctorItems =
    options.health?.problems.map(
      (problem, index): ExceptionCenterItem => ({
        id: `doctor-${index}`,
        title: L('dashboard.model.titles.runtimeHealth'),
        href: '/loops',
        level: 'warning',
        reason: raw(problem),
        owner: L('dashboard.model.owners.runtimeOwner'),
        action: L('dashboard.model.actions.runDoctor'),
        evidence: raw(options.health?.root ?? ''),
        impact: L('dashboard.model.impact.doctor'),
        retryAction: L('dashboard.model.retryAction.doctor'),
        evidenceHref: '/loops',
        source: 'doctor',
      }),
    ) ?? [];
  const evalItems =
    options.evalPlan?.checks
      .filter((check) => check.hardGate && check.status !== 'passed')
      .map(
        (check): ExceptionCenterItem => ({
          id: `eval-${check.id}`,
          title: L('dashboard.model.titles.evalHardGate'),
          href: '/loops#eval-plan',
          level: check.status === 'blocked' ? 'critical' : 'warning',
          reason:
            check.status === 'blocked'
              ? L('dashboard.model.reasons.evalBlocked', { id: check.id })
              : L('dashboard.model.reasons.evalNeedsEvidence', { id: check.id }),
          owner: L('dashboard.model.owners.evalOwner'),
          action:
            check.status === 'blocked'
              ? L('dashboard.model.actions.resolveHardGate')
              : L('dashboard.model.actions.collectEvidence'),
          evidence: check.evidence,
          impact:
            check.status === 'blocked'
              ? L('dashboard.model.impact.evalBlocked')
              : L('dashboard.model.impact.evalNeedsEvidence'),
          retryAction:
            check.status === 'blocked'
              ? L('dashboard.model.retryAction.evalBlocked')
              : L('dashboard.model.retryAction.evalNeedsEvidence'),
          evidenceHref: '/loops#eval-plan',
          source: 'eval',
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
    items: [...loopItems, ...evalItems, ...runtimeItems, ...doctorItems]
      .sort((a, b) => {
        const severity = exceptionSeverityRank(a.level) - exceptionSeverityRank(b.level);
        if (severity !== 0) return severity;
        const SOURCE_RANK: Record<ExceptionSource, number> = {
          cost: 0,
          pause: 1,
          review: 2,
          'runtime-security': 3,
          runtime: 4,
          eval: 5,
          doctor: 6,
        };
        return SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.id.localeCompare(b.id);
      })
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
        evidence: L('dashboard.model.evidence.agentsTools', {
          agents: readAgents,
          tools: readTools,
        }),
      },
      {
        id: 'write',
        state: writeAgents || writeTools ? 'enabled' : 'planned',
        evidence: L('dashboard.model.evidence.agentsTools', {
          agents: writeAgents,
          tools: writeTools,
        }),
      },
      {
        id: 'shell',
        state: testAgents ? 'restricted' : 'planned',
        evidence: testAgents
          ? L('dashboard.model.evidence.agentsRunTests', { count: testAgents })
          : L('dashboard.model.evidence.noShellTest'),
      },
      {
        id: 'network',
        state: plannedCompatibility ? 'planned' : 'restricted',
        evidence: plannedCompatibility
          ? L('dashboard.model.evidence.compatPlanned', { count: plannedCompatibility })
          : L('dashboard.model.evidence.noNetworkDeclared'),
      },
      {
        id: 'approval',
        state: approvalAgents ? 'enabled' : 'planned',
        evidence: approvalAgents
          ? L('dashboard.model.evidence.agentsRequireApproval', { count: approvalAgents })
          : L('dashboard.model.evidence.noApprovalDeclared'),
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
    supportedStages: [
      L('dashboard.model.stages.intake'),
      L('dashboard.model.stages.spec'),
      L('dashboard.model.stages.planning'),
      L('dashboard.model.stages.review'),
      L('dashboard.model.stages.release'),
    ],
    permissionProfile: L('dashboard.model.runtime.codexPermission'),
    workspacePolicy: L('dashboard.model.runtime.codexWorkspace'),
    costPolicy: L('dashboard.model.runtime.sharedCostGuard'),
    fallbackPolicy: L('dashboard.model.runtime.fallbackDeterministic'),
  },
  'claude-code': {
    id: 'runtime-backend-claude-code',
    name: 'Claude Code CLI',
    kind: 'claude-code-cli',
    supportedStages: [
      L('dashboard.model.stages.implementation'),
      L('dashboard.model.stages.testExecution'),
      L('dashboard.model.stages.secondOpinion'),
    ],
    permissionProfile: L('dashboard.model.runtime.claudePermission'),
    workspacePolicy: L('dashboard.model.runtime.claudeWorkspace'),
    costPolicy: L('dashboard.model.runtime.sharedCostGuard'),
    fallbackPolicy: L('dashboard.model.runtime.fallbackPauseRecovery'),
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
        evidence: (() => {
          const detected = selected?.version ?? selected?.image ?? runtime?.workspaceId;
          return detected ? raw(detected) : L('dashboard.model.evidence.detected');
        })(),
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
        ? L('dashboard.model.eval.architectureAttention', { count: active.length })
        : L('dashboard.model.eval.architectureClear'),
    },
    {
      id: 'delivery-readiness',
      status: blockedLoops.length > 0 ? 'blocked' : active.length > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: blockedLoops.length
        ? L('dashboard.model.eval.deliveryBlocked', { count: blockedLoops.length })
        : active.length
          ? L('dashboard.model.eval.deliveryMoving', { count: active.length })
          : L('dashboard.model.eval.deliveryClear'),
    },
    {
      id: 'runtime-safety',
      status: runtimeSecurityExceptions > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: runtimeSecurityExceptions
        ? L('dashboard.model.eval.runtimeExceptions', { count: runtimeSecurityExceptions })
        : L('dashboard.model.eval.runtimeClear'),
    },
    {
      id: 'test-evidence',
      status:
        failedEvidenceLoops.length > 0 ? 'blocked' : active.length > 0 ? 'attention' : 'passed',
      hardGate: true,
      evidence: failedEvidenceLoops.length
        ? L('dashboard.model.eval.testFailed', { count: failedEvidenceLoops.length })
        : active.length
          ? L('dashboard.model.eval.testCollecting', { count: active.length })
          : L('dashboard.model.eval.testPassed'),
    },
    {
      id: 'cost-policy',
      status: costTripped > 0 ? 'blocked' : 'passed',
      hardGate: true,
      evidence: costTripped
        ? L('dashboard.model.eval.costTripped', { count: costTripped })
        : L('dashboard.model.eval.costClear'),
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
    const phase = state?.phase ?? issue.status;
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
      phase: phaseL(phase),
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
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([phase, count]) => ({ phase: phaseL(phase), count })),
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
): LocalizableText {
  if (blocked > 0 && step.id === 'codeReview') {
    return L('dashboard.model.workflow.blocked', { count: blocked });
  }
  if (count > 0) {
    return L('dashboard.model.workflow.loops', { count });
  }
  if (step.id === 'browserQa') {
    return L('dashboard.model.workflow.browserQaPlanned');
  }
  if (step.id === 'release') {
    return L('dashboard.model.workflow.releasePlanned');
  }
  return L('dashboard.model.workflow.noLoops');
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
      evidence:
        specPending > 0
          ? L('dashboard.model.gates.specsNeedDecision', { count: specPending })
          : L('dashboard.model.gates.specClear'),
    },
    {
      kind: 'architecture',
      status: architectureReady > 0 || closed > 0 ? 'passed' : 'pending',
      count: architectureReady,
      evidence:
        architectureReady > 0
          ? L('dashboard.model.gates.decomposed', { count: architectureReady })
          : L('dashboard.model.gates.waitingDecomposition'),
    },
    {
      kind: 'code',
      status: blocked > 0 ? 'blocked' : codeNeedsChanges > 0 ? 'needsChanges' : 'pending',
      count: codeNeedsChanges + blocked,
      evidence:
        blocked > 0
          ? L('dashboard.model.gates.blockedException', { count: blocked })
          : codeNeedsChanges > 0
            ? L('dashboard.model.gates.reviewsNeedChanges', { count: codeNeedsChanges })
            : L('dashboard.model.gates.codePending'),
    },
    {
      kind: 'security',
      status: closed > 0 ? 'passed' : 'pending',
      count: closed,
      evidence:
        closed > 0
          ? L('dashboard.model.gates.deliveredReadyAudit', { count: closed })
          : L('dashboard.model.gates.securityPlanned'),
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
        evidence: L('dashboard.model.meta.phaseShards', {
          phase: phaseL(phase),
          done: shardsDone,
          total: shardsTotal,
        }),
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

export interface RecipeAdminItem {
  loopKind: string;
  count: number;
  blockedCount: number;
  blockerRate: number;
  avgShardsDone: number;
  avgShardsTotal: number;
}

export type RecipeAdminActionId = 'createVersion' | 'reviewApproval' | 'rollbackVersion';

export interface RecipeAdminAction {
  id: RecipeAdminActionId;
  state: 'ready' | 'blocked';
  evidence: LocalizableText;
  sourcePermission?: string;
}

export interface RecipeAdminSummary {
  summary: {
    totalKinds: number;
    totalLoops: number;
    totalBlocked: number;
  };
  tenantGovernance?: {
    scope: string;
    granted: boolean;
    requiredAction: string;
    sourcePermission: string;
  };
  actions: RecipeAdminAction[];
  items: RecipeAdminItem[];
}

/**
 * gstack/0 P2-6: Derive recipe usage metrics from existing loop list data.
 * Shows per-loop-kind usage count, blocker rate, and average shard progress.
 * Computed entirely from LoopListItem data; no new persistence required.
 */
export function buildRecipeAdminSummary(
  items: LoopListItem[],
  cost?: import('@repo/contracts').LoopCostResponse,
  assetPermissions?: import('@repo/contracts').LoopAssetPermissionsResponse,
): RecipeAdminSummary {
  const costByIssue = new Map((cost?.loops ?? []).map((item) => [item.issueId, item]));
  const active = items.filter(({ issue }) => !['ARCHIVED', 'REJECTED'].includes(issue.status));

  const kindMap = new Map<
    string,
    {
      count: number;
      blockedCount: number;
      shardsDone: number[];
      shardsTotal: number[];
    }
  >();

  for (const item of active) {
    const text = `${item.issue.title} ${item.issue.targetRepo}`.toLowerCase();
    let kind = 'feature';
    if (text.includes('fix') || text.includes('bug') || text.includes('修复')) kind = 'bugfix';
    else if (text.includes('refactor') || text.includes('重构')) kind = 'refactor';
    else if (text.includes('doc') || text.includes('文档')) kind = 'docs';
    else if (/\b(deploy|ops)\b/.test(text) || text.includes('运维')) kind = 'ops';

    const entry = kindMap.get(kind) ?? {
      count: 0,
      blockedCount: 0,
      shardsDone: [],
      shardsTotal: [],
    };
    entry.count += 1;
    const costItem = costByIssue.get(item.issue.id);
    if (
      item.state?.paused ||
      costItem?.tripped ||
      (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS')
    ) {
      entry.blockedCount += 1;
    }
    if (item.state?.shardsDone !== undefined) entry.shardsDone.push(item.state.shardsDone);
    if (item.state?.shardsTotal !== undefined) entry.shardsTotal.push(item.state.shardsTotal);
    kindMap.set(kind, entry);
  }

  const items_out = [...kindMap.entries()]
    .map(([loopKind, data]) => ({
      loopKind,
      count: data.count,
      blockedCount: data.blockedCount,
      blockerRate: data.count > 0 ? Math.round((data.blockedCount / data.count) * 100) : 0,
      avgShardsDone:
        data.shardsDone.length > 0
          ? Math.round(data.shardsDone.reduce((s, v) => s + v, 0) / data.shardsDone.length)
          : 0,
      avgShardsTotal:
        data.shardsTotal.length > 0
          ? Math.round(data.shardsTotal.reduce((s, v) => s + v, 0) / data.shardsTotal.length)
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.loopKind.localeCompare(b.loopKind));
  const blueprintAsset = assetPermissions?.assets.find(
    (asset) => asset.assetKind === 'blueprint' && asset.assetId === 'delivery-blueprints',
  );
  const canCreateRecipe = Boolean(blueprintAsset?.granted);
  const totalBlocked = items_out.reduce((s, item) => s + item.blockedCount, 0);
  const sourcePermission = blueprintAsset?.sourcePermission;
  const actions: RecipeAdminAction[] = [
    {
      id: 'createVersion',
      state: canCreateRecipe ? 'ready' : 'blocked',
      evidence: canCreateRecipe
        ? L('dashboard.model.recipe.grantsVersion', {
            permission: raw(sourcePermission ?? 'authenticated'),
          })
        : L('dashboard.model.recipe.authRequired'),
      sourcePermission,
    },
    {
      id: 'reviewApproval',
      state: canCreateRecipe && totalBlocked > 0 ? 'ready' : 'blocked',
      evidence:
        totalBlocked > 0
          ? L('dashboard.model.recipe.blockedNeedApproval', { count: totalBlocked })
          : L('dashboard.model.recipe.noBlockedApproval'),
      sourcePermission,
    },
    {
      id: 'rollbackVersion',
      state: canCreateRecipe && items_out.length > 0 ? 'ready' : 'blocked',
      evidence:
        items_out.length > 0
          ? L('dashboard.model.recipe.rollbackBaseline', { count: items_out.length })
          : L('dashboard.model.recipe.noRollbackBaseline'),
      sourcePermission,
    },
  ];

  return {
    summary: {
      totalKinds: items_out.length,
      totalLoops: active.length,
      totalBlocked,
    },
    tenantGovernance: blueprintAsset
      ? {
          scope: blueprintAsset.scope,
          granted: blueprintAsset.granted,
          requiredAction: blueprintAsset.requiredAction,
          sourcePermission: blueprintAsset.sourcePermission,
        }
      : undefined,
    actions,
    items: items_out,
  };
}

export function formatPhase(phase: string) {
  return PHASE_LABELS[phase] ?? phase.replace('PHASE_', 'P').replaceAll('_', ' ');
}

// ============================================================================
// Blueprint Marketplace (P1-2, 0623 · CrewAI). Shows available delivery
// blueprints with their personas, eval suites, gates, and cost policies.
// Derived from the existing template/recipe data — no new persistence.
// ============================================================================

export interface BlueprintMarketplaceItem {
  id: string;
  label: LocalizableText;
  description: LocalizableText;
  personaCount: number;
  evalCount: number;
  gateCount: number;
  humanGateCount: number;
  defaultPriority: string;
  primaryRuntime: string;
}

export interface BlueprintMarketplace {
  summary: { total: number; activeUse: number };
  blueprints: BlueprintMarketplaceItem[];
}

const BLUEPRINTS: Omit<BlueprintMarketplaceItem, 'activeUse'>[] = [
  {
    id: 'bugfix',
    label: L('dashboard.model.loopTypes.bugfix'),
    description: L('dashboard.model.loopDescription.bugfix'),
    personaCount: 6,
    evalCount: 5,
    gateCount: 4,
    humanGateCount: 1,
    defaultPriority: 'P0',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'feature',
    label: L('dashboard.model.loopTypes.feature'),
    description: L('dashboard.model.loopDescription.feature'),
    personaCount: 9,
    evalCount: 5,
    gateCount: 3,
    humanGateCount: 1,
    defaultPriority: 'P1',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'refactor',
    label: L('dashboard.model.loopTypes.refactor'),
    description: L('dashboard.model.loopDescription.refactor'),
    personaCount: 9,
    evalCount: 5,
    gateCount: 3,
    humanGateCount: 1,
    defaultPriority: 'P2',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'docs',
    label: L('dashboard.model.loopTypes.documentation'),
    description: L('dashboard.model.loopDescription.documentation'),
    personaCount: 4,
    evalCount: 3,
    gateCount: 2,
    humanGateCount: 1,
    defaultPriority: 'P3',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'integration',
    label: L('dashboard.model.loopTypes.integration'),
    description: L('dashboard.model.loopDescription.integration'),
    personaCount: 9,
    evalCount: 5,
    gateCount: 4,
    humanGateCount: 2,
    defaultPriority: 'P1',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'flow',
    label: L('dashboard.model.loopTypes.flow'),
    description: L('dashboard.model.loopDescription.flow'),
    personaCount: 9,
    evalCount: 5,
    gateCount: 4,
    humanGateCount: 2,
    defaultPriority: 'P1',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'security',
    label: L('dashboard.model.loopTypes.securityPatch'),
    description: L('dashboard.model.loopDescription.securityPatch'),
    personaCount: 6,
    evalCount: 5,
    gateCount: 4,
    humanGateCount: 2,
    defaultPriority: 'P0',
    primaryRuntime: 'Codex CLI',
  },
  {
    id: 'dependency',
    label: L('dashboard.model.loopTypes.dependencyUpgrade'),
    description: L('dashboard.model.loopDescription.dependencyUpgrade'),
    personaCount: 3,
    evalCount: 5,
    gateCount: 3,
    humanGateCount: 0,
    defaultPriority: 'P2',
    primaryRuntime: 'Codex CLI',
  },
];

export function buildBlueprintMarketplace(items: LoopListItem[]): BlueprintMarketplace {
  const activeKindSet = new Set<string>();
  for (const item of items) {
    const t = item.issue.title.toLowerCase();
    if (t.includes('fix') || t.includes('bug')) activeKindSet.add('bugfix');
    else if (t.includes('refactor')) activeKindSet.add('refactor');
    else if (t.includes('doc')) activeKindSet.add('docs');
    else if (t.includes('integrat')) activeKindSet.add('integration');
    else if (t.includes('flow')) activeKindSet.add('flow');
    else if (t.includes('secur')) activeKindSet.add('security');
    else if (t.includes('upgrade') || t.includes('depend')) activeKindSet.add('dependency');
    else activeKindSet.add('feature');
  }

  return {
    summary: { total: BLUEPRINTS.length, activeUse: activeKindSet.size },
    blueprints: BLUEPRINTS,
  };
}

// ============================================================================
// Fleet Health (P2-1, 0623 · CrewAI). Engineering Agent Control Plane summary
// showing delivery health, runtime health, cost, and human gate status across
// all active loops. Derived from existing data — no new persistence.
// ============================================================================

export interface FleetHealthPanel {
  summary: {
    activeLoops: number;
    blockedLoops: number;
    runtimeReady: number;
    runtimeDegraded: number;
    costTripped: number;
    humanGatesWaiting: number;
    releaseReady: number;
  };
  repoBreakdown: Array<{
    repo: string;
    active: number;
    blocked: number;
    runtimeMode: string;
  }>;
}

export function buildFleetHealth(
  items: LoopListItem[],
  options: { cost?: LoopCostResponse; agentRuntime?: LoopAgentRuntimeResponse } = {},
): FleetHealthPanel {
  const costByIssue = new Map((options.cost?.loops ?? []).map((item) => [item.issueId, item]));
  const active = items.filter(
    ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
  );
  const blocked = active.filter((item) => {
    const c = costByIssue.get(item.issue.id);
    return Boolean(
      item.state?.paused ||
      c?.tripped ||
      (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS'),
    );
  });
  const costTripped = (options.cost?.loops ?? []).filter((l) => l.tripped).length;
  const humanGatesWaiting = active.filter((item) => item.state?.phase === 'PHASE_2_REVIEW').length;
  const releaseReady = active.filter(
    (item) => item.state?.globalVerdict === 'PASS' || item.state?.finalized,
  ).length;
  const runtimes = options.agentRuntime?.runtimes ?? [];
  const runtimeReady = runtimes.filter(
    (r) => r.selected?.status === 'ready' && r.checks.length === 0,
  ).length;
  const runtimeDegraded = runtimes.filter(
    (r) => r.checks.length > 0 || r.selected?.status === 'missing',
  ).length;

  const repoMap = new Map<string, { active: number; blocked: number; modes: string[] }>();
  for (const item of active) {
    const repo = item.issue.targetRepo || 'unassigned';
    const existing = repoMap.get(repo) ?? { active: 0, blocked: 0, modes: [] };
    existing.active++;
    if (blocked.some((b) => b.issue.id === item.issue.id)) existing.blocked++;
    repoMap.set(repo, existing);
  }
  for (const runtime of runtimes) {
    for (const [, entry] of repoMap) {
      if (!entry.modes.includes(runtime.selected?.mode ?? runtime.preferredMode)) {
        entry.modes.push(runtime.selected?.mode ?? runtime.preferredMode);
      }
    }
  }

  return {
    summary: {
      activeLoops: active.length,
      blockedLoops: blocked.length,
      runtimeReady,
      runtimeDegraded,
      costTripped,
      humanGatesWaiting,
      releaseReady,
    },
    repoBreakdown: [...repoMap.entries()]
      .map(([repo, data]) => ({
        repo,
        active: data.active,
        blocked: data.blocked,
        runtimeMode: data.modes.join(', '),
      }))
      .sort((a, b) => b.active - a.active),
  };
}

// ============================================================================
// Rules Center (P2-2, 0623). Organization-level rule definitions derived
// from workspace rule snapshots + architecture compliance rules. v1 shows
// which rules apply and their enforcement status per workspace.
// ============================================================================

export interface RuleCenterItem {
  id: string;
  label: LocalizableText;
  category: 'architecture' | 'security' | 'testing' | 'workspace';
  enforced: boolean;
  violations: number;
  evidence: LocalizableText;
}

export interface RulesCenter {
  summary: { total: number; enforced: number; violations: number };
  rules: RuleCenterItem[];
}

export function buildRulesCenter(
  items: LoopListItem[],
  options: { agentRuntime?: LoopAgentRuntimeResponse } = {},
): RulesCenter {
  const runtimeChecks = options.agentRuntime?.runtimes ?? [];
  const hasRuntimeChecks = runtimeChecks.some((r) => r.checks.length > 0);
  const allRuntimeReady = runtimeChecks.every(
    (r) => r.selected?.status === 'ready' && r.checks.length === 0,
  );

  const rules: RuleCenterItem[] = [
    {
      id: 'db-service-layer',
      label: L('dashboard.model.rules.dbAccessOnly'),
      category: 'architecture',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.architectureLayering'),
    },
    {
      id: 'zod-contracts',
      label: L('dashboard.model.rules.zodContracts'),
      category: 'architecture',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.contractFirst'),
    },
    {
      id: 'client-layer',
      label: L('dashboard.model.rules.externalApisClient'),
      category: 'architecture',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.httpService'),
    },
    {
      id: 'winston-logger',
      label: L('dashboard.model.rules.winstonLogger'),
      category: 'architecture',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.winstonProvider'),
    },
    {
      id: 'path-policy',
      label: L('dashboard.model.rules.pathPolicy'),
      category: 'security',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.pathPolicyRuntime'),
    },
    {
      id: 'network-policy',
      label: L('dashboard.model.rules.networkDeny'),
      category: 'security',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.networkSnapshot'),
    },
    {
      id: 'secret-canary',
      label: L('dashboard.model.rules.secretCanary'),
      category: 'security',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.canaryTracked'),
    },
    {
      id: 'test-required',
      label: L('dashboard.model.rules.testsBeforeFinalize'),
      category: 'testing',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.releaseGateChecklist'),
    },
    {
      id: 'coverage-required',
      label: L('dashboard.model.rules.coverageReported'),
      category: 'testing',
      enforced: false,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.softSignal'),
    },
    {
      id: 'workspace-mount',
      label: L('dashboard.model.rules.workspaceMount'),
      category: 'workspace',
      enforced: hasRuntimeChecks,
      violations: allRuntimeReady ? 0 : 1,
      evidence: allRuntimeReady
        ? L('dashboard.model.ruleEvidence.allRuntimesReady')
        : L('dashboard.model.ruleEvidence.runtimeChecksPending'),
    },
    {
      id: 'target-repo-scope',
      label: L('dashboard.model.rules.targetRepoWrite'),
      category: 'security',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.runtimeWritePolicy'),
    },
    {
      id: 'rule-snapshot',
      label: L('dashboard.model.rules.claudeAgents'),
      category: 'workspace',
      enforced: true,
      violations: 0,
      evidence: L('dashboard.model.ruleEvidence.capturedAtIntake'),
    },
  ];

  return {
    summary: {
      total: rules.length,
      enforced: rules.filter((r) => r.enforced).length,
      violations: rules.filter((r) => r.violations > 0).length,
    },
    rules,
  };
}

// ============================================================================
// Runtime Security Panel (gstack/0 P0-1, 0623).
// Aggregates runtime security exceptions across loops into a dashboard panel
// showing policy status, violation rates, active overrides, and top exceptions.
// ============================================================================

export interface RuntimeSecurityPolicyStatus {
  strategy: LocalizableText;
  active: boolean;
  violations: number;
  overrides: number;
}

export interface RuntimeSecurityPanel {
  summary: {
    totalLoops: number;
    loopsWithViolations: number;
    totalViolations: number;
    totalOverrides: number;
    criticalCount: number;
    warningCount: number;
  };
  policies: RuntimeSecurityPolicyStatus[];
  topViolations: Array<{
    issueId: string;
    title: string;
    href: string;
    level: 'critical' | 'warning';
    reason: string;
  }>;
}

export function buildRuntimeSecurityPanel(
  items: LoopListItem[],
  options: { agentRuntime?: LoopAgentRuntimeResponse } = {},
): RuntimeSecurityPanel {
  const active = items.filter(({ issue }) => !['ARCHIVED', 'REJECTED'].includes(issue.status));

  // Collect all runtime security exceptions.
  let totalViolations = 0;
  let criticalCount = 0;
  let warningCount = 0;
  const topViolations: RuntimeSecurityPanel['topViolations'] = [];

  for (const item of active) {
    const exceptions = item.runtimeSecurityExceptions ?? [];
    totalViolations += exceptions.length;
    for (const ex of exceptions) {
      if (ex.level === 'critical') criticalCount++;
      else warningCount++;
      topViolations.push({
        issueId: item.issue.id,
        title: item.issue.title,
        href: `/loops/${item.issue.id}`,
        level: ex.level,
        reason: ex.reason,
      });
    }
  }

  // Policy status based on detection data.
  const policies: RuntimeSecurityPolicyStatus[] = [
    {
      strategy: L('dashboard.model.securityStrategy.commandAllowlist'),
      active: true,
      violations: active.filter((item) =>
        (item.runtimeSecurityExceptions ?? []).some(
          (ex) => ex.reason.includes('command') || ex.reason.includes('blocked'),
        ),
      ).length,
      overrides: 0,
    },
    {
      strategy: L('dashboard.model.securityStrategy.networkDeny'),
      active: true,
      violations: active.filter((item) =>
        (item.runtimeSecurityExceptions ?? []).some((ex) => ex.reason.includes('network')),
      ).length,
      overrides: 0,
    },
    {
      strategy: L('dashboard.model.securityStrategy.writeScoped'),
      active: true,
      violations: active.filter((item) =>
        (item.runtimeSecurityExceptions ?? []).some(
          (ex) => ex.reason.includes('write') || ex.reason.includes('rm -rf'),
        ),
      ).length,
      overrides: 0,
    },
    {
      strategy: L('dashboard.model.securityStrategy.secretCanary'),
      active: true,
      violations: active.filter((item) =>
        (item.runtimeSecurityExceptions ?? []).some(
          (ex) => ex.reason.includes('secret') || ex.reason.includes('canary'),
        ),
      ).length,
      overrides: 0,
    },
  ];

  // Runtime overrides from detection data.
  let totalOverrides = 0;
  for (const item of items) {
    const overrides = item.deliveryGovernance?.runtimeOverrides ?? [];
    totalOverrides += overrides.length;
  }

  return {
    summary: {
      totalLoops: active.length,
      loopsWithViolations: active.filter(
        (item) => (item.runtimeSecurityExceptions?.length ?? 0) > 0,
      ).length,
      totalViolations,
      totalOverrides,
      criticalCount,
      warningCount,
    },
    policies,
    topViolations: topViolations.sort((a, b) => (a.level === 'critical' ? -1 : 1)).slice(0, 5),
  };
}

// ============================================================================
// Loop Bench (gstack/0 P2-7): Derived quality metrics from existing loop state,
// cost, and trace evidence. No new persistence required — all metrics are
// computed from the existing LoopListItem list, LoopCostResponse, and
// LoopAgentRuntimeResponse data surfaces already fetched by the dashboard.
// ============================================================================

export interface LoopBenchSummary {
  firstPassReviewRate: number;
  browserQaRegressionRate: number;
  secondOpinionConflictRate: number;
  releaseBlockerRate: number;
  runtimeViolationRate: number;
  learningReuseRate: number;
  canaryPassRate: number;
}

export function buildLoopBench(
  items: LoopListItem[],
  options: {
    cost?: import('@repo/contracts').LoopCostResponse;
    agentRuntime?: import('@repo/contracts').LoopAgentRuntimeResponse;
    recentLearnings?: import('@repo/contracts').LoopLearning[];
  } = {},
): LoopBenchSummary {
  const active = items.filter(
    ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
  );
  const completed = items.filter(
    ({ issue, state }) =>
      issue.status === 'CLOSED' || state?.finalized || state?.phase === 'CLOSED',
  );

  // First-pass review rate: share of completed loops with globalVerdict PASS
  // and zero reloops, meaning no rework was required.
  const firstPassCount = completed.filter(
    ({ state }) => state?.globalVerdict === 'PASS' && (state.reloopCount ?? 0) === 0,
  ).length;
  const firstPassReviewRate =
    completed.length > 0 ? Math.round((firstPassCount / completed.length) * 100) : 0;

  // Browser QA regression rate: loops whose release gate shows
  // browserQaPassed = false. Derived from per-list-item release gate data.
  const browserQaRegressionCount = active.filter(
    ({ releaseGate }) => releaseGate?.checklist.browserQaPassed === false,
  ).length;
  const browserQaRegressionRate =
    active.length > 0 ? Math.round((browserQaRegressionCount / active.length) * 100) : 0;

  // Second opinion conflict rate: active loops whose release gate shows
  // secondOpinionPassed = false.
  const secondOpinionConflictCount = active.filter(({ releaseGate, state }) => {
    const phase = state?.phase ?? 'PHASE_0_INTAKE';
    const inConvergePhase = [
      'PHASE_6_CONVERGE',
      'PHASE_7_GLOBAL_REVIEW',
      'PHASE_8_ANNOTATE',
    ].includes(phase);
    return inConvergePhase && releaseGate?.checklist.secondOpinionPassed === false;
  }).length;
  const secondOpinionConflictRate =
    active.length > 0 ? Math.round((secondOpinionConflictCount / active.length) * 100) : 0;

  // Release blocker rate: loops blocked before finalize.
  const blockedCount = active.filter(
    ({ state }) => state?.paused || (state?.globalVerdict && state.globalVerdict !== 'PASS'),
  ).length;
  const costTripped = options.cost?.loops.filter((item) => item.tripped).length ?? 0;
  const releaseBlockerRate =
    active.length > 0 ? Math.round(((blockedCount + costTripped) / active.length) * 100) : 0;

  // Runtime violation rate: loops with recorded runtime security exceptions.
  const violationCount = items.reduce(
    (sum, item) => sum + (item.runtimeSecurityExceptions?.length ?? 0),
    0,
  );
  const runtimeViolationRate =
    items.length > 0 ? Math.round((violationCount / items.length) * 100) : 0;

  // Learning reuse rate: share of recent learnings with lastUsedAt timestamp
  // (indicating they have been recalled in a subsequent loop).
  const learnings = options.recentLearnings ?? [];
  const reusedCount = learnings.filter((l) => l.lastUsedAt).length;
  const learningReuseRate =
    learnings.length > 0 ? Math.round((reusedCount / learnings.length) * 100) : 0;
  const canaryResults = items
    .map(({ releaseGate }) => releaseGate?.checklist.canaryPassed)
    .filter((value): value is boolean => value !== undefined);
  const canaryPassCount = canaryResults.filter(Boolean).length;
  const canaryPassRate =
    canaryResults.length > 0 ? Math.round((canaryPassCount / canaryResults.length) * 100) : 0;

  return {
    firstPassReviewRate,
    browserQaRegressionRate,
    secondOpinionConflictRate,
    releaseBlockerRate,
    runtimeViolationRate,
    learningReuseRate,
    canaryPassRate,
  };
}

// ============================================================================
// Release Gate Dashboard Panel (gstack/0 P2, 0623).
// Aggregates per-loop release gate checklist data into a single dashboard panel
// showing overall release readiness, blocker counts, and per-checklist pass rates.
// ============================================================================

export interface ReleaseGateChecklistItem {
  key: string;
  passed: number;
  total: number;
  rate: number;
  blocked: number;
}

export interface ReleaseGateBlocker {
  issueId: string;
  title: string;
  href: string;
  reason: LocalizableText;
}

export interface ReleaseGatePanel {
  summary: {
    totalWithGate: number;
    ready: number;
    blocked: number;
  };
  checklist: ReleaseGateChecklistItem[];
  topBlockers: ReleaseGateBlocker[];
}

export function buildReleaseGatePanel(
  items: LoopListItem[],
  options: { cost?: LoopCostResponse } = {},
): ReleaseGatePanel {
  const costByIssue = new Map((options.cost?.loops ?? []).map((item) => [item.issueId, item]));
  const active = items.filter(
    ({ issue }) => !['CLOSED', 'ARCHIVED', 'REJECTED'].includes(issue.status),
  );
  const withGate = active.filter(({ releaseGate }) => releaseGate?.checklist);
  const blocked = withGate.filter((item) => {
    const costItem = costByIssue.get(item.issue.id);
    return Boolean(
      item.state?.paused ||
      costItem?.tripped ||
      (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS') ||
      item.releaseGate?.blocker,
    );
  });

  const CHECKLIST_KEYS: Array<{
    key: string;
    extract: (c: NonNullable<LoopListItem['releaseGate']>['checklist']) => boolean;
  }> = [
    { key: 'specApproved', extract: (c) => c.specApproved },
    { key: 'implementationEvidence', extract: (c) => c.implementationEvidence },
    { key: 'testsPassed', extract: (c) => c.testsPassed },
    { key: 'requiredReviewsPassed', extract: (c) => c.requiredReviewsPassed },
    { key: 'secondOpinionPassed', extract: (c) => c.secondOpinionPassed ?? true },
    { key: 'browserQaPassed', extract: (c) => c.browserQaPassed },
    { key: 'docsUpdated', extract: (c) => c.docsUpdated },
    { key: 'prReady', extract: (c) => c.prReady },
    { key: 'rollbackNote', extract: (c) => c.rollbackNote },
    { key: 'canaryPassed', extract: (c) => c.canaryPassed ?? true },
  ];

  const checklist: ReleaseGateChecklistItem[] = CHECKLIST_KEYS.map(({ key, extract }) => {
    let passed = 0;
    let failed = 0;
    for (const item of withGate) {
      if (!item.releaseGate?.checklist) continue;
      if (extract(item.releaseGate.checklist)) passed++;
      else failed++;
    }
    const total = passed + failed;
    return {
      key,
      passed,
      total,
      rate: total > 0 ? Math.round((passed / total) * 100) : 0,
      blocked: failed,
    };
  }).sort((a, b) => a.rate - b.rate); // lowest pass rate first

  const topBlockers: ReleaseGateBlocker[] = blocked.slice(0, 5).map((item) => ({
    issueId: item.issue.id,
    title: item.issue.title,
    href: `/loops/${item.issue.id}`,
    reason: item.releaseGate?.blocker
      ? raw(item.releaseGate.blocker)
      : item.state?.paused
        ? L('dashboard.model.reasons.paused')
        : item.state?.globalVerdict
          ? L('dashboard.model.reasons.globalVerdict', { verdict: item.state.globalVerdict })
          : L('dashboard.model.reasons.needsReview'),
  }));

  return {
    summary: {
      totalWithGate: withGate.length,
      ready: withGate.length - blocked.length,
      blocked: blocked.length,
    },
    checklist,
    topBlockers,
  };
}

// ============================================================================
// Tool & Integration Registry Lifecycle (0623 · CrewAI gap 5).
// Enhances the existing Capability Registry with lifecycle, health, auth,
// and audit usage views derived from the agent/tool registry data.
// ============================================================================

export interface ToolLifecycleItem {
  id: string;
  label: string;
  kind: string;
  lifecycle: string;
  ownerIds: string[];
  permissions: string[];
  compatibility: string;
  deterministicBoundary: string;
}

export interface ToolRegistryLifecycle {
  summary: {
    totalTools: number;
    activeTools: number;
    plannedTools: number;
    activeAgents: number;
  };
  tools: ToolLifecycleItem[];
  compatibilityStatus: {
    total: number;
    pass: number;
    planned: number;
    fail: number;
  };
}

export function buildToolRegistryLifecycle(
  registry?: LoopAgentToolRegistry,
): ToolRegistryLifecycle {
  const tools: ToolLifecycleItem[] = (registry?.tools ?? [])
    .map((tool) => ({
      id: tool.id,
      label: tool.label,
      kind: tool.kind,
      lifecycle: tool.lifecycle,
      ownerIds: tool.ownerAgentIds,
      permissions: tool.permissions,
      compatibility: [
        tool.compatibility.codex ? 'Codex' : '',
        tool.compatibility.claudeCode ? 'Claude Code' : '',
        tool.compatibility.thirdParty !== 'unsupported'
          ? `3rd:${tool.compatibility.thirdParty}`
          : '',
      ]
        .filter(Boolean)
        .join(', '),
      deterministicBoundary: tool.deterministicBoundary,
    }))
    .sort((a, b) => a.lifecycle.localeCompare(b.lifecycle) || a.label.localeCompare(b.label));

  const checks = registry?.compatibilityChecks ?? [];
  const activeTools = tools.filter((t) => t.lifecycle === 'active').length;
  const plannedTools = tools.filter((t) => t.lifecycle !== 'active').length;
  const activeAgents = (registry?.agents ?? []).filter((a) => a.lifecycle === 'active').length;

  return {
    summary: {
      totalTools: tools.length,
      activeTools,
      plannedTools,
      activeAgents,
    },
    tools,
    compatibilityStatus: {
      total: checks.length,
      pass: checks.filter((c) => c.status === 'pass').length,
      planned: checks.filter((c) => c.status === 'planned').length,
      fail: checks.filter((c) => c.status === 'fail').length,
    },
  };
}

// ============================================================================
// Trigger Lifecycle (0623 · CrewAI gap 6).
// Enhances the existing Trigger Portfolio with lifecycle status (active/paused/
// failed), source health, and replay/retry indicators derived from loop source
// data.
// ============================================================================

export interface TriggerLifecycleSource {
  id: string;
  count: number;
  latest: string;
  status: 'active' | 'paused' | 'error';
  repos: string[];
}

export interface TriggerLifecycle {
  summary: {
    totalSources: number;
    activeSources: number;
    totalLoops: number;
    repos: number;
  };
  sources: TriggerLifecycleSource[];
}

export function buildTriggerLifecycle(items: LoopListItem[]): TriggerLifecycle {
  const sourceMap = new Map<
    string,
    {
      count: number;
      latest: string;
      repos: Set<string>;
      activeCount: number;
      errorCount: number;
    }
  >();
  let totalLoops = 0;
  const allRepos = new Set<string>();

  for (const { issue, state } of items) {
    if (['ARCHIVED', 'REJECTED'].includes(issue.status)) continue;
    totalLoops++;
    allRepos.add(issue.targetRepo);
    const source = `${issue.sourceChannel}/${issue.sourceKind}`;
    const existing = sourceMap.get(source) ?? {
      count: 0,
      latest: '',
      repos: new Set(),
      activeCount: 0,
      errorCount: 0,
    };
    existing.count += 1;
    existing.repos.add(issue.targetRepo);
    if (issue.created > existing.latest) existing.latest = issue.created;

    const isBlocked = Boolean(
      state?.paused || (state?.globalVerdict && state.globalVerdict !== 'PASS'),
    );
    if (isBlocked) existing.errorCount += 1;
    else existing.activeCount += 1;

    sourceMap.set(source, existing);
  }

  const sources: TriggerLifecycleSource[] = [...sourceMap.entries()]
    .map(([id, data]) => ({
      id,
      count: data.count,
      latest: data.latest,
      status: (data.errorCount > 0
        ? 'error'
        : data.activeCount > 0
          ? 'active'
          : 'paused') as TriggerLifecycleSource['status'],
      repos: [...data.repos],
    }))
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));

  return {
    summary: {
      totalSources: sources.length,
      activeSources: sources.filter((s) => s.status === 'active').length,
      totalLoops,
      repos: allRepos.size,
    },
    sources,
  };
}

// ============================================================================
// Delivery Flow (P1-1, R8 · 0623 crewAI). Visualizes the full loop pipeline
// as a flow diagram with runtime owners and human/automated gate markers.
// ============================================================================

export interface DeliveryFlowStep {
  id: string;
  label: LocalizableText;
  phases: string[];
  runtimeOwner: 'codex' | 'claude-code' | 'human' | 'system';
  gateKind: 'none' | 'human' | 'agent' | 'release';
  loopCount: number;
  blockedCount: number;
}

export interface DeliveryFlow {
  summary: { totalSteps: number; activeSteps: number; blockedSteps: number };
  steps: DeliveryFlowStep[];
  pipelineLabel: LocalizableText;
}

const DELIVERY_FLOW_PIPELINE: Array<{
  id: string;
  phases: string[];
  runtimeOwner: 'codex' | 'claude-code' | 'human' | 'system';
  gateKind: 'none' | 'human' | 'agent' | 'release';
}> = [
  {
    id: 'intake',
    phases: ['PHASE_0_INTAKE'],
    runtimeOwner: 'system',
    gateKind: 'none',
  },
  {
    id: 'spec',
    phases: ['PHASE_1_SPEC'],
    runtimeOwner: 'codex',
    gateKind: 'none',
  },
  {
    id: 'review',
    phases: ['PHASE_2_REVIEW'],
    runtimeOwner: 'human',
    gateKind: 'human',
  },
  {
    id: 'decompose',
    phases: ['PHASE_3_DECOMPOSE'],
    runtimeOwner: 'codex',
    gateKind: 'none',
  },
  {
    id: 'implement',
    phases: ['PHASE_4_IMPLEMENT'],
    runtimeOwner: 'claude-code',
    gateKind: 'agent',
  },
  {
    id: 'test',
    phases: ['PHASE_5_REVIEW'],
    runtimeOwner: 'codex',
    gateKind: 'agent',
  },
  {
    id: 'converge',
    phases: ['PHASE_6_CONVERGE'],
    runtimeOwner: 'codex',
    gateKind: 'agent',
  },
  {
    id: 'globalReview',
    phases: ['PHASE_7_GLOBAL_REVIEW'],
    runtimeOwner: 'codex',
    gateKind: 'agent',
  },
  {
    id: 'annotate',
    phases: ['PHASE_8_ANNOTATE'],
    runtimeOwner: 'codex',
    gateKind: 'none',
  },
  {
    id: 'close',
    phases: ['CLOSED'],
    runtimeOwner: 'system',
    gateKind: 'release',
  },
];

export function buildDeliveryFlow(items: LoopListItem[]): DeliveryFlow {
  const active = items.filter(({ issue }) => !['ARCHIVED', 'REJECTED'].includes(issue.status));

  const steps: DeliveryFlowStep[] = DELIVERY_FLOW_PIPELINE.map((def) => {
    let loopCount = 0;
    let blockedCount = 0;
    for (const item of active) {
      const phase = item.state?.phase ?? 'PHASE_0_INTAKE';
      if (def.phases.includes(phase)) {
        loopCount++;
        if (
          item.state?.paused ||
          (item.state?.globalVerdict && item.state.globalVerdict !== 'PASS')
        ) {
          blockedCount++;
        }
      }
    }
    return {
      ...def,
      label: L(`dashboard.model.deliveryFlow.steps.${def.id}`),
      loopCount,
      blockedCount,
    };
  });

  return {
    summary: {
      totalSteps: steps.length,
      activeSteps: steps.filter((s) => s.loopCount > 0).length,
      blockedSteps: steps.filter((s) => s.blockedCount > 0).length,
    },
    steps,
    pipelineLabel: L('dashboard.model.deliveryFlow.pipeline'),
  };
}
