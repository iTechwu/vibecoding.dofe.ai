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
  deliveryEvidence: (issueId: string) => [...loopsKeys.all, 'delivery-evidence', issueId] as const,
  doctor: () => [...loopsKeys.all, 'doctor'] as const,
  cost: () => [...loopsKeys.all, 'cost'] as const,
  metrics: () => [...loopsKeys.all, 'metrics'] as const,
  agentRuntime: () => [...loopsKeys.all, 'agent-runtime'] as const,
  capabilities: () => [...loopsKeys.all, 'capabilities'] as const,
  workspaces: () => [...loopsKeys.all, 'workspaces'] as const,
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

/** Current Loops agent runtime status and diagnostics. */
export function useLoopsAgentRuntime() {
  const queryKey = loopsKeys.agentRuntime();
  return tsRestClient.loops.agentRuntime.useQuery(queryKey, {}, { queryKey, staleTime: 0 });
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

/**
 * Phases that represent an actively-running loop. While an issue sits in one of
 * these phases (and is not paused), the detail view polls so background
 * scheduler progress surfaces without a manual refresh. Terminal phases
 * (`CLOSED`/`PAUSED`) and terminal statuses stop polling.
 */
const LIVE_LOOP_PHASES = new Set([
  'PHASE_4_IMPLEMENT',
  'PHASE_5_REVIEW',
  'PHASE_6_CONVERGE',
  'PHASE_7_GLOBAL_REVIEW',
]);

const TERMINAL_LOOP_STATUSES = new Set(['CLOSED', 'ARCHIVED', 'REJECTED']);

const LOOP_POLL_INTERVAL_MS = 4000;

/**
 * `refetchInterval` predicate for the issue detail query: poll only while the
 * loop is live, stop on terminal/paused states. Returns `false` to disable.
 */
function liveLoopRefetchInterval(query: {
  state: {
    data?: {
      body?: {
        data?: { issue?: { status?: string }; state?: { phase?: string; paused?: boolean } };
      };
    };
  };
}): number | false {
  const detail = query.state.data?.body?.data;
  if (!detail) return false;
  if (detail.state?.paused) return false;
  const status = detail.issue?.status;
  if (status && TERMINAL_LOOP_STATUSES.has(status)) return false;
  if (status === 'IN_LOOP') return LOOP_POLL_INTERVAL_MS;
  const phase = detail.state?.phase;
  if (phase && LIVE_LOOP_PHASES.has(phase)) return LOOP_POLL_INTERVAL_MS;
  return false;
}

/** Loops issue detail (spec, shards, state, records). */
export function useLoopIssue(issueId: string) {
  const queryKey = loopsKeys.detail(issueId);
  return tsRestClient.loops.getIssue.useQuery(
    queryKey,
    { params: { issueId } },
    {
      queryKey,
      enabled: Boolean(issueId),
      // Poll for live progress while the loop is running; auto-stops at
      // terminal / paused states. Previously the detail view never polled, so
      // a Continue Loop action left the UI stale until the HTTP round-trip returned.
      refetchInterval: liveLoopRefetchInterval,
    },
  );
}

/** Derived, PR-ready delivery evidence summary for a Loops issue (P0-4). */
export function useLoopDeliveryEvidence(issueId: string) {
  const queryKey = loopsKeys.deliveryEvidence(issueId);
  return tsRestClient.loops.getDeliveryEvidence.useQuery(
    queryKey,
    { params: { issueId } },
    {
      queryKey,
      enabled: Boolean(issueId),
      staleTime: 0,
    },
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

/** Advance a loop through the compatibility scheduler endpoint. */
export function useRunLoop(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.runLoop.useMutation({ onSuccess: invalidate });
}

/** Advance the issue to the next product-level checkpoint. */
export function useAdvanceLoop(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.advance.useMutation({ onSuccess: invalidate });
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

/** Run report-only Browser QA for a loop issue. */
export function useRunLoopBrowserQa(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.runBrowserQa.useMutation({ onSuccess: invalidate });
}

/** Run Claude Code second-opinion review for a loop issue. */
export function useRunLoopSecondOpinion(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.runSecondOpinion.useMutation({ onSuccess: invalidate });
}

/** Resolve a second-opinion conflict (accept primary/secondary or waive) - P1-5. */
export function useResolveSecondOpinion(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.resolveSecondOpinion.useMutation({ onSuccess: invalidate });
}

/** Record per-loop delivery governance decisions and policies. */
export function useGovernLoopDelivery(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.governDelivery.useMutation({ onSuccess: invalidate });
}

/** Run a release canary check (smoke + Browser QA subset) for a loop issue. */
export function useRunLoopReleaseCanary(issueId: string) {
  const invalidate = useInvalidateIssue(issueId);
  return tsRestClient.loops.runReleaseCanary.useMutation({ onSuccess: invalidate });
}

// ============================================================================
// Loops Workspace + Runtime (0622 · B2/B6)
// ============================================================================

/** List configured Loops workspaces + the active workspace id. */
export function useLoopsWorkspaces() {
  const queryKey = loopsKeys.workspaces();
  return tsRestClient.loops.listWorkspaces.useQuery(queryKey, {}, { queryKey, staleTime: 0 });
}

/**
 * Create / update a workspace, detect runtime, or pull an image. All invalidate
 * the workspaces + agent-runtime queries so the console reflects the new state.
 */
function useInvalidateWorkspaceRuntime() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: loopsKeys.workspaces() });
    queryClient.invalidateQueries({ queryKey: loopsKeys.agentRuntime() });
  };
}

/** Upsert a workspace (root, agent modes, makeDefault). */
export function useUpsertLoopsWorkspace() {
  const invalidate = useInvalidateWorkspaceRuntime();
  return tsRestClient.loops.upsertWorkspace.useMutation({ onSuccess: invalidate });
}

/** Dismiss or merge a reusable Loop learning memory item. */
export function useGovernLoopLearning() {
  const queryClient = useQueryClient();
  return tsRestClient.loops.governLearning.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loopsKeys.workspaces() });
    },
  });
}

/** Promote similar learning suggestions into pending approval candidates. */
export function useRunLoopLearningAutoMergeWorker() {
  const queryClient = useQueryClient();
  return tsRestClient.loops.runLearningAutoMergeWorker.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loopsKeys.workspaces() });
    },
  });
}

/** Probe local CLI + Docker runtimes for a workspace (Retry detection). */
export function useDetectLoopsRuntime() {
  const invalidate = useInvalidateWorkspaceRuntime();
  return tsRestClient.loops.detectWorkspaceRuntime.useMutation({ onSuccess: invalidate });
}

/** Pull the Docker fallback image for an agent in a workspace. */
export function usePullLoopsImage() {
  const invalidate = useInvalidateWorkspaceRuntime();
  return tsRestClient.loops.pullWorkspaceImage.useMutation({ onSuccess: invalidate });
}

/** Retry agent-runtime detection (refetch). */
export function useRetryLoopsAgentRuntime() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: loopsKeys.agentRuntime() });
}

// ============================================================================
// Simple issue intake (0622 · B4/B5)
// ============================================================================

/**
 * Create an issue from a single natural-language request. Submitter is derived
 * server-side; the hook returns the created issue so the caller can navigate.
 */
export function useCreateSimpleLoopIssue() {
  return tsRestClient.loops.createSimpleIssue.useMutation();
}
