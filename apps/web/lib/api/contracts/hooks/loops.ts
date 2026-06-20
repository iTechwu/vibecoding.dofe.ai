'use client';

import { useQueryClient } from '@tanstack/react-query';
import { tsRestClient } from '../client';

/**
 * Loops Query Keys — React Query cache management.
 * Issue-scoped keys are invalidated after any issue mutation so the console
 * and detail views refresh without a full reload.
 */
export const loopsKeys = {
  all: ['loops'] as const,
  lists: () => [...loopsKeys.all, 'list'] as const,
  list: (query: Record<string, unknown>) => [...loopsKeys.lists(), query] as const,
  detail: (issueId: string) => [...loopsKeys.all, 'detail', issueId] as const,
  doctor: () => [...loopsKeys.all, 'doctor'] as const,
  cost: () => [...loopsKeys.all, 'cost'] as const,
  metrics: () => [...loopsKeys.all, 'metrics'] as const,
  capabilities: () => [...loopsKeys.all, 'capabilities'] as const,
  logs: (query: Record<string, unknown>) => [...loopsKeys.all, 'logs', query] as const,
  notifications: (query: Record<string, unknown>) =>
    [...loopsKeys.all, 'notifications', query] as const,
};

// ============================================================================
// Loops Query Hooks
// ============================================================================

/** List Loops issues (paginated). */
export function useLoopsList(query: { page?: number; limit?: number } = {}) {
  const q = { page: 1, limit: 20, ...query };
  return tsRestClient.loops.list.useQuery(loopsKeys.list(q), { query: q });
}

/** Loops file/DB state doctor. */
export function useLoopsDoctor() {
  const queryKey = loopsKeys.doctor();
  return tsRestClient.loops.doctor.useQuery(queryKey, {}, { queryKey, staleTime: 0 });
}

/** Loops cost guard / circuit breaker state. */
export function useLoopsCost() {
  const queryKey = loopsKeys.cost();
  return tsRestClient.loops.cost.useQuery(queryKey, {}, { queryKey, staleTime: 0 });
}

/** Aggregated Loops control-plane metrics. */
export function useLoopsMetrics() {
  const queryKey = loopsKeys.metrics();
  return tsRestClient.loops.metrics.useQuery(queryKey, {}, { queryKey, staleTime: 0 });
}

/** Loops capability registry and planned integration surface. */
export function useLoopsCapabilities() {
  const queryKey = loopsKeys.capabilities();
  return tsRestClient.loops.capabilities.useQuery(queryKey, {}, { queryKey, staleTime: 0 });
}

/** Recent Loops log events. */
export function useLoopsLogs(query: { issueId?: string; limit?: number } = {}) {
  return tsRestClient.loops.logs.useQuery(loopsKeys.logs(query), { query });
}

/** Recorded Loops notifications. */
export function useLoopsNotifications(query: { issueId?: string; limit?: number } = {}) {
  return tsRestClient.loops.notifications.useQuery(loopsKeys.notifications(query), { query });
}

/** Loops issue detail (spec, shards, state, records). */
export function useLoopIssue(issueId: string) {
  const queryKey = loopsKeys.detail(issueId);
  return tsRestClient.loops.getIssue.useQuery(
    queryKey,
    { params: { issueId } },
    { queryKey, enabled: Boolean(issueId) },
  );
}

// ============================================================================
// Loops Mutation Hooks
// All issue-scoped mutations invalidate the affected issue detail + the list so
// the console refreshes after an operation.
// ============================================================================

function useInvalidateIssue(issueId?: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: loopsKeys.lists() });
    if (issueId) {
      queryClient.invalidateQueries({ queryKey: loopsKeys.detail(issueId) });
    }
    queryClient.invalidateQueries({ queryKey: loopsKeys.doctor() });
    queryClient.invalidateQueries({ queryKey: loopsKeys.cost() });
    queryClient.invalidateQueries({ queryKey: loopsKeys.metrics() });
  };
}

/** Create a Web issue intake. Submitter is derived server-side from the SSO user. */
export function useCreateLoopIssue() {
  return tsRestClient.loops.createIssue.useMutation();
}

/** Recover interrupted Loops shards. */
export function useResumeLoops() {
  const queryClient = useQueryClient();
  return tsRestClient.loops.resume.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loopsKeys.all });
    },
  });
}

/** Generate an MVP draft spec. */
export function useGenerateLoopSpec(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.generateSpec.useMutation({
    onSuccess: invalidate,
  });
}

/** Approve / revise / reject a spec. */
export function useReviewLoopSpec(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.reviewSpec.useMutation({ onSuccess: invalidate });
}

/** Decompose an approved spec into shards. */
export function useDecomposeLoop(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.decompose.useMutation({ onSuccess: invalidate });
}

/** Run a shard's tests. */
export function useRunLoopShardTests(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.runShardTests.useMutation({ onSuccess: invalidate });
}

/** Record implementation evidence for a shard. */
export function useRecordLoopShardImplementation(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.recordShardImplementation.useMutation({
    onSuccess: invalidate,
  });
}

/** Review a shard's implementation evidence. */
export function useReviewLoopShard(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.reviewShard.useMutation({ onSuccess: invalidate });
}

/** Advance a loop one scheduler step. */
export function useRunLoop(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.runLoop.useMutation({ onSuccess: invalidate });
}

/** Phase 7 global review. */
export function useReviewLoopGlobal(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.reviewGlobal.useMutation({ onSuccess: invalidate });
}

/** Re-loop (bump spec version). */
export function useReloopIssue(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.reloop.useMutation({ onSuccess: invalidate });
}

/** Finalize / close an issue. */
export function useFinalizeLoop(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.finalize.useMutation({ onSuccess: invalidate });
}

/** Pause / resume / take over an issue or shard. */
export function useInterveneLoop(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.intervene.useMutation({ onSuccess: invalidate });
}
