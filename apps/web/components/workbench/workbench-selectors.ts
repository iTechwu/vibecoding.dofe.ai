import type { LoopIssueListItem } from '@repo/contracts';

const TERMINAL_STATUSES = new Set(['CLOSED', 'ARCHIVED', 'REJECTED']);

function isPaused(item: LoopIssueListItem) {
  return item.state?.paused === true || item.state?.phase === 'PAUSED';
}

function isTerminal(item: LoopIssueListItem) {
  return TERMINAL_STATUSES.has(item.issue.status);
}

function needsHumanAttention(item: LoopIssueListItem) {
  return item.state?.phase === 'PHASE_2_REVIEW' || isPaused(item);
}

/** Chooses the most useful issue to continue without changing API order. */
export function selectContinuationIssue(items: LoopIssueListItem[]) {
  return (
    items.find((item) => item.issue.status === 'IN_LOOP' && !isPaused(item)) ??
    items.find((item) => !isPaused(item) && item.issue.status !== 'CLOSED') ??
    items[0]
  );
}

/** Groups issues by the operator attention that they need, preserving list order. */
export function selectActionableIssues(items: LoopIssueListItem[]) {
  const humanReview: LoopIssueListItem[] = [];
  const activeLoops: LoopIssueListItem[] = [];
  const otherActive: LoopIssueListItem[] = [];
  const terminal: LoopIssueListItem[] = [];

  for (const item of items) {
    if (needsHumanAttention(item)) {
      humanReview.push(item);
    } else if (isTerminal(item)) {
      terminal.push(item);
    } else if (item.issue.status === 'IN_LOOP') {
      activeLoops.push(item);
    } else {
      otherActive.push(item);
    }
  }

  return [...humanReview, ...activeLoops, ...otherActive, ...terminal];
}
