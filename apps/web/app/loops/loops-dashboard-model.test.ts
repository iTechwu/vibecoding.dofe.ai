import { describe, expect, it } from 'vitest';
import type { LoopCostResponse, LoopListResponse } from '@repo/contracts';
import {
  AGING_QUEUE_SLA_POLICY,
  aggregateLoops,
  buildAgingQueue,
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
      'Global FAIL',
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
          label: 'Run step',
          priority: 'P2',
          phase: 'PHASE_4_IMPLEMENT',
          href: '/loops/issue-2',
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
  });

  it('formats known and unknown phases for display', () => {
    expect(formatPhase('PHASE_4_IMPLEMENT')).toBe('Implement');
    expect(formatPhase('PHASE_9_CUSTOM')).toBe('P9 CUSTOM');
  });
});
