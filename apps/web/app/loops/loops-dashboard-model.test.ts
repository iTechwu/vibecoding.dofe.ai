import { describe, expect, it } from 'vitest';
import type { LoopAgentRuntimeResponse, LoopCostResponse, LoopListResponse } from '@repo/contracts';
import {
  AGING_QUEUE_SLA_POLICY,
  aggregateLoops,
  buildAgingQueue,
  buildDashboardGuide,
  buildExceptionCenter,
  buildLoopBoard,
  buildPermissionProfile,
  buildPerformanceSnapshot,
  buildProviderProfile,
  buildRepoContextMap,
  buildReleaseReadiness,
  buildReviewGatePortfolio,
  buildReviewInbox,
  buildReviewInboxGroups,
  buildRiskQueue,
  buildTriggerPortfolio,
  buildWorkflowRecipe,
  formatPhase,
} from './loops-dashboard-model';

const list: LoopListResponse = {
  list: [
    {
      issue: {
        id: 'issue-1',
        title: 'Critical checkout fix',
        status: 'IN_LOOP',
        priority: 'P0',
        created: '2026-06-20T00:00:00.000Z',
        updated: '2026-06-20T00:00:00.000Z',
        sourceChannel: 'web',
        sourceKind: 'web_form',
        submitterId: 'u1',
        submitterName: 'Ada',
        targetRepo: '/repo/app',
        body: 'Fix checkout',
        acceptanceCriteria: ['passes'],
        rawPayloadRef: '.loops/intakes/issue-1.raw.json',
      },
      state: {
        issueId: 'issue-1',
        phase: 'PHASE_4_IMPLEMENT',
        round: 2,
        specVersion: 'v1',
        shardsTotal: 3,
        shardsDone: 1,
        shardsInProgress: 1,
        reloopCount: 0,
        costTokens: 100,
        costCalls: 4,
        updated: '2026-06-20T00:00:00.000Z',
        paused: false,
      },
    },
    {
      issue: {
        id: 'issue-2',
        title: 'Docs reloop',
        status: 'OPEN',
        priority: 'P2',
        created: '2026-06-20T00:00:00.000Z',
        updated: '2026-06-20T00:00:00.000Z',
        sourceChannel: 'web',
        sourceKind: 'web_form',
        submitterId: 'u2',
        submitterName: 'Grace',
        targetRepo: '/repo/docs',
        body: 'Update docs',
        acceptanceCriteria: ['documented'],
        rawPayloadRef: '.loops/intakes/issue-2.raw.json',
      },
      state: {
        issueId: 'issue-2',
        phase: 'PHASE_6_CONVERGE',
        round: 3,
        specVersion: 'v2',
        shardsTotal: 2,
        shardsDone: 2,
        shardsInProgress: 0,
        reloopCount: 1,
        costTokens: 900,
        costCalls: 10,
        updated: '2026-06-20T00:00:00.000Z',
        paused: true,
        globalVerdict: 'FAIL',
      },
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
};

const cost: LoopCostResponse = {
  loops: [
    {
      issueId: 'issue-1',
      costTokens: 100,
      costCalls: 4,
      tokenCap: 1000,
      callCap: 10,
      tokensRemaining: 900,
      callsRemaining: 6,
      paused: false,
      tripped: false,
    },
    {
      issueId: 'issue-2',
      costTokens: 1000,
      costCalls: 10,
      tokenCap: 1000,
      callCap: 10,
      tokensRemaining: 0,
      callsRemaining: 0,
      paused: true,
      tripped: true,
    },
  ],
};

const runtime: LoopAgentRuntimeResponse = {
  summary: {
    running: 1,
    attention: 1,
    idle: 2,
    total: 4,
  },
  agents: [],
  diagnostics: [
    {
      id: 'runtime-issue-2',
      agentId: 'spec-review-agent',
      issueId: 'issue-2',
      title: 'Docs reloop',
      href: '/loops/issue-2',
      level: 'warning',
      reason: 'Spec draft is waiting for human review',
      meta: 'Review · round 3',
      updated: '2026-06-20T00:00:00.000Z',
    },
  ],
};

const registry = {
  agents: [
    {
      id: 'codex-planner-reviewer',
      label: 'Codex Planner / Reviewer',
      provider: 'codex' as const,
      lifecycle: 'active' as const,
      responsibilities: ['Plan and review loop work.'],
      supportedPhases: ['PHASE_1_SPEC' as const, 'PHASE_5_REVIEW' as const],
      permissions: ['read-repo' as const, 'run-tests' as const],
      toolIds: ['spec-shard-planner'],
    },
    {
      id: 'claude-code-implementer',
      label: 'Claude Code Implementer',
      provider: 'claude-code' as const,
      lifecycle: 'active' as const,
      responsibilities: ['Implement approved shards.'],
      supportedPhases: ['PHASE_4_IMPLEMENT' as const],
      permissions: ['read-repo' as const, 'write-repo' as const, 'run-tests' as const],
      toolIds: ['repo-code-editor'],
    },
  ],
  tools: [
    {
      id: 'spec-shard-planner',
      label: 'Spec / Shard Planner',
      kind: 'artifact' as const,
      lifecycle: 'active' as const,
      ownerAgentIds: ['codex-planner-reviewer'],
      permissions: ['read-repo' as const],
      deterministicBoundary: 'Writes Loops planning artifacts through service.',
      compatibility: { codex: true, claudeCode: false, thirdParty: 'planned' as const },
    },
    {
      id: 'repo-code-editor',
      label: 'Repository Code Editor',
      kind: 'code-execution' as const,
      lifecycle: 'active' as const,
      ownerAgentIds: ['claude-code-implementer'],
      permissions: ['write-repo' as const],
      deterministicBoundary: 'Requires approved shard scope.',
      compatibility: { codex: false, claudeCode: true, thirdParty: 'planned' as const },
    },
  ],
  compatibilityChecks: [
    {
      id: 'phase-tool-ownership',
      status: 'pass' as const,
      summary: 'Every active tool has an active owner.',
    },
  ],
};

describe('loops-dashboard-model', () => {
  it('aggregates control-plane health metrics', () => {
    const summary = aggregateLoops(list, cost);

    expect(summary.active).toBe(2);
    expect(summary.inLoop).toBe(1);
    expect(summary.paused).toBe(1);
    expect(summary.costTripped).toHaveLength(1);
    expect(summary.attention).toBe(4);
    expect(summary.phaseCounts.PHASE_4_IMPLEMENT).toBe(1);
    expect(summary.phaseCounts.PHASE_6_CONVERGE).toBe(1);
    expect(summary.minCallsRemaining).toBe(0);
    expect(summary.minTokensRemaining).toBe(0);
  });

  it('prioritizes paused, cost, verdict, and high-priority risks', () => {
    const risks = buildRiskQueue(list.list, cost);

    expect(risks.map((risk) => risk.reason)).toEqual([
      'P0 priority',
      'Paused',
      'Cost guard tripped',
      'Global review needs work',
    ]);
  });

  it('flags active issues that have not moved for more than 24 hours', () => {
    const aging = buildAgingQueue(list.list, new Date('2026-06-23T01:00:00.000Z'));

    expect(aging.map((item) => [item.title, item.level, item.ageHours])).toEqual([
      ['Critical checkout fix', 'critical', 73],
      ['Docs reloop', 'critical', 73],
    ]);
  });

  it('documents warning and critical aging thresholds in one policy', () => {
    expect(AGING_QUEUE_SLA_POLICY).toMatchObject({
      warningHours: 24,
      criticalHours: 72,
    });

    const warningAging = buildAgingQueue(list.list, new Date('2026-06-21T01:00:00.000Z'));

    expect(warningAging.map((item) => [item.title, item.level, item.ageHours])).toEqual([
      ['Critical checkout fix', 'warning', 25],
      ['Docs reloop', 'warning', 25],
    ]);
  });

  it('builds a human review inbox from actions and notifications', () => {
    const inbox = buildReviewInbox(
      [
        {
          issueId: 'issue-1',
          title: 'Critical checkout fix',
          action: 'review-spec',
          nextActionCategory: 'decision',
          label: 'Review spec',
          priority: 'P0',
          phase: 'PHASE_2_REVIEW',
          href: '/loops/issue-1',
        },
        {
          issueId: 'issue-2',
          title: 'Docs reloop',
          action: 'run-step',
          nextActionCategory: 'continue',
          label: 'Continue loop',
          priority: 'P2',
          phase: 'PHASE_4_IMPLEMENT',
          href: '/loops/issue-2',
        },
        {
          issueId: 'issue-3',
          title: 'Finalize delivery',
          action: 'finalize',
          nextActionCategory: 'continue',
          label: 'Continue loop',
          priority: 'P1',
          phase: 'PHASE_6_CONVERGE',
          href: '/loops/issue-3',
        },
        {
          issueId: 'issue-4',
          title: 'Paused implementation',
          action: 'resume',
          nextActionCategory: 'exception',
          label: 'Continue loop',
          priority: 'P1',
          phase: 'PAUSED',
          href: '/loops/issue-4',
        },
      ],
      [
        {
          id: 'note-1',
          issueId: 'issue-2',
          channel: 'web',
          kind: 'COST_GUARD_TRIPPED',
          recipient: 'human',
          title: 'Cost guard needs review',
          body: 'Budget is exhausted.',
          status: 'RECORDED',
          actionHref: '/loops/issue-2',
          created: '2026-06-20T00:00:00.000Z',
        },
      ],
    );

    expect(inbox.map((item) => [item.title, item.source, item.priority])).toEqual([
      ['Cost guard needs review', 'notification', 'critical'],
      ['Critical checkout fix', 'action', 'warning'],
    ]);
    expect(inbox.map((item) => [item.title, item.gateKind])).toEqual([
      ['Cost guard needs review', 'exception'],
      ['Critical checkout fix', 'product'],
    ]);
    expect(inbox.map((item) => item.title)).not.toContain('Finalize delivery');
    expect(inbox.map((item) => item.title)).not.toContain('Paused implementation');
  });

  it('groups review inbox items by gate kind', () => {
    const inbox = buildReviewInbox([
      {
        issueId: 'issue-1',
        title: 'Spec needs approval',
        action: 'review-spec',
        nextActionCategory: 'decision',
        label: 'Review spec',
        priority: 'P0',
        phase: 'PHASE_2_REVIEW',
        href: '/loops/issue-1',
      },
      {
        issueId: 'issue-2',
        title: 'Security finding',
        action: 'run-step',
        nextActionCategory: 'decision',
        label: 'Security review',
        priority: 'P1',
        phase: 'PHASE_5_REVIEW',
        href: '/loops/issue-2',
      },
      {
        issueId: 'issue-3',
        title: 'Release approval',
        action: 'finalize',
        nextActionCategory: 'decision',
        label: 'Ship approval',
        priority: 'P1',
        phase: 'PHASE_7_GLOBAL_REVIEW',
        href: '/loops/issue-3',
      },
      {
        issueId: 'issue-4',
        title: 'Reloop decision',
        action: 'reloop',
        nextActionCategory: 'decision',
        label: 'Reloop',
        priority: 'P0',
        phase: 'PHASE_7_GLOBAL_REVIEW',
        href: '/loops/issue-4',
      },
    ]);

    const groups = buildReviewInboxGroups(inbox);

    expect(groups.map((group) => [group.gateKind, group.count, group.priority])).toEqual([
      ['exception', 1, 'critical'],
      ['product', 1, 'warning'],
      ['security', 1, 'warning'],
      ['release', 1, 'warning'],
    ]);
    expect(groups.flatMap((group) => group.items.map((item) => item.title))).toEqual([
      'Reloop decision',
      'Spec needs approval',
      'Security finding',
      'Release approval',
    ]);
  });

  it('uses next action category before internal action codes for human decisions', () => {
    const inbox = buildReviewInbox([
      {
        issueId: 'issue-5',
        title: 'Human approval needed',
        action: 'run-step',
        nextActionCategory: 'decision',
        label: 'Approve plan',
        priority: 'P1',
        phase: 'PHASE_2_REVIEW',
        href: '/loops/issue-5',
      },
    ]);

    expect(inbox.map((item) => item.title)).toEqual(['Human approval needed']);
  });

  it('builds a loop board with user-facing stages, modes, and delivery signals', () => {
    const readyItem: LoopListResponse['list'][number] = {
      issue: {
        id: 'issue-3',
        title: 'Ready release',
        status: 'IN_LOOP',
        priority: 'P1',
        created: '2026-06-20T00:00:00.000Z',
        updated: '2026-06-20T00:00:00.000Z',
        sourceChannel: 'web',
        sourceKind: 'web_form',
        submitterId: 'u3',
        submitterName: 'Lin',
        targetRepo: '/repo/app',
        body: 'Prepare release',
        acceptanceCriteria: ['ready'],
        rawPayloadRef: '.loops/intakes/issue-3.raw.json',
      },
      state: {
        issueId: 'issue-3',
        phase: 'PHASE_7_GLOBAL_REVIEW',
        round: 1,
        specVersion: 'v1',
        shardsTotal: 1,
        shardsDone: 1,
        shardsInProgress: 0,
        reloopCount: 0,
        costTokens: 200,
        costCalls: 2,
        updated: '2026-06-20T00:00:00.000Z',
        paused: false,
        globalVerdict: 'PASS',
      },
    };
    const board = buildLoopBoard([...list.list, readyItem], cost);

    expect(board.map((column) => [column.id, column.items.map((item) => item.title)])).toEqual([
      ['backlog', []],
      ['specReview', []],
      ['running', ['Critical checkout fix']],
      ['blocked', ['Docs reloop']],
      ['readyToShip', ['Ready release']],
      ['delivered', []],
    ]);

    const running = board.find((column) => column.id === 'running')?.items[0];
    expect(running).toMatchObject({
      mode: 'Code',
      humanGate: 'None',
      evidence: '1/3 shards',
      gitRef: 'loops/issue-1',
      prState: 'Pending PR',
    });

    const blocked = board.find((column) => column.id === 'blocked')?.items[0];
    expect(blocked).toMatchObject({
      mode: 'Recovery',
      humanGate: 'Exception',
      blocker: 'Cost guard',
      evidence: '2/2 shards',
    });

    const ready = board.find((column) => column.id === 'readyToShip')?.items[0];
    expect(ready).toMatchObject({
      mode: 'Review',
      humanGate: 'Release',
      evidence: '1/1 shards',
      prState: 'Ready to ship',
    });
  });

  it('builds an exception center with owners, actions, evidence, and capacity', () => {
    const center = buildExceptionCenter(list.list, {
      cost,
      runtime,
      health: {
        ok: false,
        root: '/repo/.loops',
        loops: 2,
        issues: 2,
        fileProblems: [],
        dbProblems: [],
        consistencyProblems: ['issue index is stale'],
        problems: ['issue index is stale'],
      },
    });

    expect(center.capacity).toEqual({
      running: 1,
      queued: 0,
      attention: 1,
      failed: 1,
      capacity: 4,
    });
    expect(center.items.map((item) => [item.reason, item.level, item.owner, item.action])).toEqual([
      ['Cost guard tripped', 'critical', 'Product owner', 'Adjust budget or reduce scope'],
      ['Paused', 'critical', 'Loop operator', 'Resume or assign recovery'],
      ['Global FAIL', 'warning', 'Reviewer', 'Review failure evidence'],
      ['Spec draft is waiting for human review', 'warning', 'spec-review-agent', 'Open diagnostic'],
      ['issue index is stale', 'warning', 'Runtime owner', 'Run doctor or re-index'],
    ]);
    expect(center.items[0]).toMatchObject({
      title: 'Docs reloop',
      href: '/loops/issue-2',
      evidence: '0 calls · 0 tokens remaining',
      impact: 'Loop is paused before more agent calls are allowed',
      retryAction: 'Raise cap or split scope, then continue the loop',
      evidenceHref: '/loops/issue-2',
      source: 'cost',
    });
  });

  it('builds a dashboard guide that orients first-time users to the next action', () => {
    const guide = buildDashboardGuide({
      totalIssues: list.total,
      reviewItems: 1,
      exceptionItems: 5,
      deliveredItems: 0,
    });

    expect(guide.map((item) => [item.id, item.state, item.href])).toEqual([
      ['create', 'done', '/loops/new'],
      ['review', 'active', '/loops'],
      ['exceptions', 'active', '/loops'],
      ['evidence', 'pending', '/loops'],
    ]);
  });

  it('marks create as the active dashboard guide step when no issues exist', () => {
    const guide = buildDashboardGuide({
      totalIssues: 0,
      reviewItems: 0,
      exceptionItems: 0,
      deliveredItems: 0,
    });

    expect(guide.map((item) => [item.id, item.state])).toEqual([
      ['create', 'active'],
      ['review', 'pending'],
      ['exceptions', 'pending'],
      ['evidence', 'pending'],
    ]);
  });

  it('builds a permission profile from the agent tool registry', () => {
    const profile = buildPermissionProfile(registry);

    expect(profile.summary).toEqual({
      agents: 2,
      tools: 2,
      activeTools: 2,
      plannedCompatibility: 2,
    });
    expect(profile.modes.map((mode) => [mode.id, mode.state, mode.evidence])).toEqual([
      ['read', 'enabled', '2 agents · 1 tools'],
      ['write', 'enabled', '1 agents · 1 tools'],
      ['shell', 'restricted', '2 agents can run tests'],
      ['network', 'planned', '2 third-party tool compatibilities planned'],
      ['approval', 'planned', 'No human approval gate declared'],
    ]);
  });

  it('builds a provider profile from registry and runtime detection', () => {
    const profile = buildProviderProfile(registry, {
      ...runtime,
      runtimes: [
        {
          agent: 'codex',
          preferredMode: 'local-cli',
          selected: { mode: 'local-cli', status: 'ready', workspaceRequired: false },
          checks: [],
        },
        {
          agent: 'claude-code',
          preferredMode: 'docker',
          selected: { mode: 'docker', status: 'ready', workspaceRequired: true },
          checks: [],
        },
      ],
    });

    expect(profile.summary).toEqual({
      providers: 2,
      activeAgents: 2,
      plannedTools: 2,
    });
    expect(profile.items.map((item) => [item.provider, item.agents, item.runtimeMode])).toEqual([
      ['claude-code', 1, 'docker'],
      ['codex', 1, 'local-cli'],
    ]);
  });

  it('builds a performance snapshot from loop state, costs, and trace summary', () => {
    const passedItem: LoopListResponse['list'][number] = {
      issue: {
        id: 'issue-3',
        title: 'Delivered onboarding',
        status: 'CLOSED',
        priority: 'P1',
        created: '2026-06-20T00:00:00.000Z',
        updated: '2026-06-20T00:00:00.000Z',
        sourceChannel: 'web',
        sourceKind: 'web_form',
        submitterId: 'u3',
        submitterName: 'Lin',
        targetRepo: '/repo/app',
        body: 'Ship onboarding',
        acceptanceCriteria: ['done'],
        rawPayloadRef: '.loops/intakes/issue-3.raw.json',
      },
      state: {
        issueId: 'issue-3',
        phase: 'CLOSED',
        round: 1,
        specVersion: 'v1',
        shardsTotal: 1,
        shardsDone: 1,
        shardsInProgress: 0,
        reloopCount: 0,
        costTokens: 200,
        costCalls: 2,
        updated: '2026-06-20T00:00:00.000Z',
        paused: false,
        finalized: true,
        globalVerdict: 'PASS',
      },
    };
    const snapshot = buildPerformanceSnapshot([...list.list, passedItem], {
      cost,
      traceSummary: {
        total: 12,
        recent: 5,
      },
    });

    expect(snapshot).toEqual({
      passRate: 50,
      redoRate: 33,
      averageCalls: 7,
      averageTokens: 550,
      traceEvents: 12,
      recentEvents: 5,
    });
  });

  it('builds a trigger portfolio from existing issue intake metadata', () => {
    const portfolio = buildTriggerPortfolio(list.list);

    expect(portfolio.summary).toEqual({
      total: 2,
      sources: 1,
      repos: 2,
    });
    expect(portfolio.sources).toEqual([
      {
        id: 'web/web_form',
        count: 2,
        latest: '2026-06-20T00:00:00.000Z',
      },
    ]);
    expect(
      portfolio.recent.map((item) => [item.title, item.source, item.repo, item.submittedBy]),
    ).toEqual([
      ['Critical checkout fix', 'web/web_form', '/repo/app', 'Ada'],
      ['Docs reloop', 'web/web_form', '/repo/docs', 'Grace'],
    ]);
  });

  it('builds a repo context map from existing loop metadata', () => {
    const context = buildRepoContextMap(list.list, cost);

    expect(context.summary).toEqual({
      repos: 2,
      issues: 2,
      blocked: 1,
    });
    expect(
      context.repos.map((repo) => [repo.repo, repo.issues, repo.blocked, repo.latest]),
    ).toEqual([
      ['/repo/app', 1, 0, '2026-06-20T00:00:00.000Z'],
      ['/repo/docs', 1, 1, '2026-06-20T00:00:00.000Z'],
    ]);
    expect(context.repos[0]?.phases).toEqual([{ phase: 'Implement', count: 1 }]);
    expect(context.repos[1]?.recent).toEqual([
      {
        id: 'issue-2',
        title: 'Docs reloop',
        href: '/loops/issue-2',
        status: 'OPEN',
        phase: 'Converge',
      },
    ]);
  });

  it('builds a workflow recipe from current loop phases and gates', () => {
    const recipe = buildWorkflowRecipe(list.list, cost);

    expect(recipe.summary).toEqual({
      total: 2,
      currentStep: 'build',
      blocked: 1,
      releaseReady: 0,
    });
    expect(recipe.steps.map((step) => [step.id, step.state, step.gate, step.count])).toEqual([
      ['intake', 'done', 'none', 0],
      ['plan', 'done', 'human', 0],
      ['build', 'current', 'agent', 1],
      ['codeReview', 'blocked', 'agent', 1],
      ['browserQa', 'waiting', 'agent', 0],
      ['release', 'waiting', 'release', 0],
      ['reflect', 'waiting', 'none', 0],
    ]);
    expect(recipe.steps.map((step) => step.evidence)).toEqual([
      'No loops',
      'No loops',
      '1 loops',
      '1 blocked',
      'Browser QA gate planned',
      'Release gate planned',
      'No loops',
    ]);
  });

  it('builds multi-review gates from loop state and exception evidence', () => {
    const gates = buildReviewGatePortfolio(list.list, cost);

    expect(gates.summary).toEqual({
      total: 4,
      passed: 2,
      pending: 1,
      blocked: 1,
    });
    expect(gates.gates.map((gate) => [gate.kind, gate.status, gate.count, gate.evidence])).toEqual([
      ['product', 'passed', 0, 'Spec gate clear'],
      ['architecture', 'passed', 1, '1 loops decomposed or implemented'],
      ['code', 'blocked', 2, '1 blocked by exception'],
      ['security', 'pending', 0, 'Security review planned'],
    ]);
  });

  it('builds release readiness from convergence, review, and cost evidence', () => {
    const deliveredItem: LoopListResponse['list'][number] = {
      issue: {
        id: 'issue-3',
        title: 'Ready release',
        status: 'CLOSED',
        priority: 'P1',
        created: '2026-06-20T00:00:00.000Z',
        updated: '2026-06-20T00:00:00.000Z',
        sourceChannel: 'web',
        sourceKind: 'web_form',
        submitterId: 'u3',
        submitterName: 'Lin',
        targetRepo: '/repo/app',
        body: 'Ship release',
        acceptanceCriteria: ['done'],
        rawPayloadRef: '.loops/intakes/issue-3.raw.json',
      },
      state: {
        issueId: 'issue-3',
        phase: 'CLOSED',
        round: 1,
        specVersion: 'v1',
        shardsTotal: 1,
        shardsDone: 1,
        shardsInProgress: 0,
        reloopCount: 0,
        costTokens: 200,
        costCalls: 2,
        updated: '2026-06-20T00:00:00.000Z',
        paused: false,
        finalized: true,
        globalVerdict: 'PASS',
      },
    };
    const readiness = buildReleaseReadiness([...list.list, deliveredItem], cost);

    expect(readiness.summary).toEqual({
      ready: 1,
      attention: 0,
      blocked: 1,
    });
    expect(readiness.items.map((item) => [item.title, item.state, item.evidence])).toEqual([
      ['Docs reloop', 'blocked', 'Converge · 2/2 shards'],
      ['Ready release', 'ready', 'Closed · 1/1 shards'],
    ]);
    expect(readiness.items[1]?.checklist).toEqual({
      spec: true,
      implementation: true,
      review: true,
      qa: true,
    });
  });

  it('formats known and unknown phases for display', () => {
    expect(formatPhase('PHASE_4_IMPLEMENT')).toBe('Implement');
    expect(formatPhase('PHASE_9_CUSTOM')).toBe('P9 CUSTOM');
  });
});
