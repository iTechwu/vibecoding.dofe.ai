import { describe, expect, it } from 'vitest';
import type { LoopAgentRuntimeResponse, LoopCostResponse, LoopListResponse } from '@repo/contracts';
import {
  AGING_QUEUE_SLA_POLICY,
  aggregateLoops,
  buildAgingQueue,
  buildExceptionCenter,
  buildLoopBoard,
  buildReviewInbox,
  buildRiskQueue,
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
          label: 'Review spec',
          priority: 'P0',
          phase: 'PHASE_2_REVIEW',
          href: '/loops/issue-1',
        },
        {
          issueId: 'issue-2',
          title: 'Docs reloop',
          action: 'run-step',
          label: 'Continue loop',
          priority: 'P2',
          phase: 'PHASE_4_IMPLEMENT',
          href: '/loops/issue-2',
        },
        {
          issueId: 'issue-3',
          title: 'Finalize delivery',
          action: 'finalize',
          label: 'Continue loop',
          priority: 'P1',
          phase: 'PHASE_6_CONVERGE',
          href: '/loops/issue-3',
        },
        {
          issueId: 'issue-4',
          title: 'Paused implementation',
          action: 'resume',
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
    expect(inbox.map((item) => item.title)).not.toContain('Finalize delivery');
    expect(inbox.map((item) => item.title)).not.toContain('Paused implementation');
  });

  it('builds a loop board with user-facing stages, modes, and delivery signals', () => {
    const board = buildLoopBoard(list.list, cost);

    expect(board.map((column) => [column.id, column.items.map((item) => item.title)])).toEqual([
      ['backlog', []],
      ['specReview', []],
      ['running', ['Critical checkout fix']],
      ['blocked', ['Docs reloop']],
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
      source: 'cost',
    });
  });

  it('formats known and unknown phases for display', () => {
    expect(formatPhase('PHASE_4_IMPLEMENT')).toBe('Implement');
    expect(formatPhase('PHASE_9_CUSTOM')).toBe('P9 CUSTOM');
  });
});
