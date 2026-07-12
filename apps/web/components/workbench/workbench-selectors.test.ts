import { describe, expect, it } from 'vitest';
import type { LoopIssueListItem } from '@repo/contracts';
import { selectActionableIssues, selectContinuationIssue } from './workbench-selectors';

function issue(
  id: string,
  status: string,
  options: { paused?: boolean; phase?: string } = {},
): LoopIssueListItem {
  return {
    issue: {
      id,
      title: id,
      status,
    },
    state: {
      paused: options.paused ?? false,
      phase: options.phase ?? 'PHASE_0_INTAKE',
    },
  } as LoopIssueListItem;
}

describe('workbench selectors', () => {
  it('selects a running, non-paused Loop before other issues', () => {
    const result = selectContinuationIssue([
      issue('open', 'OPEN'),
      issue('paused-loop', 'IN_LOOP', { paused: true }),
      issue('running', 'IN_LOOP'),
    ]);

    expect(result?.issue.id).toBe('running');
  });

  it('falls back to a non-paused non-CLOSED issue, then the first item', () => {
    expect(
      selectContinuationIssue([issue('closed', 'CLOSED'), issue('open', 'OPEN')])?.issue.id,
    ).toBe('open');
    expect(selectContinuationIssue([issue('closed', 'CLOSED')])?.issue.id).toBe('closed');
    expect(selectContinuationIssue([])).toBeUndefined();
  });

  it('uses the stated non-CLOSED fallback priority', () => {
    expect(
      selectContinuationIssue([issue('closed', 'CLOSED'), issue('archived', 'ARCHIVED')])?.issue.id,
    ).toBe('archived');
  });

  it('orders human review and paused issues before active work and terminal issues', () => {
    const input = [
      issue('closed', 'CLOSED'),
      issue('open', 'OPEN'),
      issue('running', 'IN_LOOP'),
      issue('review', 'OPEN', { phase: 'PHASE_2_REVIEW' }),
      issue('paused', 'OPEN', { paused: true }),
      issue('archived', 'ARCHIVED'),
    ];

    expect(selectActionableIssues(input).map((item) => item.issue.id)).toEqual([
      'review',
      'paused',
      'running',
      'open',
      'closed',
      'archived',
    ]);
  });

  it('keeps a paused terminal issue ahead of regular terminal work without mutating the input', () => {
    const input = [
      issue('closed', 'CLOSED'),
      issue('paused-archived', 'ARCHIVED', { paused: true }),
      issue('archived', 'ARCHIVED'),
    ];
    const before = input.map((item) => item.issue.id);

    expect(selectActionableIssues(input).map((item) => item.issue.id)).toEqual([
      'paused-archived',
      'closed',
      'archived',
    ]);
    expect(input.map((item) => item.issue.id)).toEqual(before);
  });

  it('does not mutate the API list while prioritizing it', () => {
    const input = [issue('open', 'OPEN'), issue('review', 'OPEN', { phase: 'PHASE_2_REVIEW' })];
    const before = input.map((item) => item.issue.id);

    const result = selectActionableIssues(input);

    expect(input.map((item) => item.issue.id)).toEqual(before);
    expect(result).not.toBe(input);
  });
});
