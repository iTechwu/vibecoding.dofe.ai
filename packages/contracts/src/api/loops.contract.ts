import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiResponseSchema } from '../base';
import {
  CreateLoopIssueRequestSchema,
  CreateLoopIssueSimpleRequestSchema,
  DetectLoopRuntimeResponseSchema,
  LoopCapabilitiesResponseSchema,
  LoopAgentRuntimeResponseSchema,
  LoopCostResponseSchema,
  LoopDetailSchema,
  LoopInterventionRequestSchema,
  LoopImplementationRecordSchema,
  LoopIssueCreatedResponseSchema,
  LoopIssuesQuerySchema,
  LoopLearningGovernanceRequestSchema,
  LoopListResponseSchema,
  LoopLogsQuerySchema,
  LoopLogsResponseSchema,
  LoopMetricsResponseSchema,
  LoopNaturalCommandRequestSchema,
  LoopNaturalCommandResponseSchema,
  LoopNotificationsQuerySchema,
  LoopNotificationsResponseSchema,
  LoopRecordShardImplementationRequestSchema,
  LoopReloopResponseSchema,
  LoopReloopRequestSchema,
  LoopReviewRecordSchema,
  LoopReviewShardRequestSchema,
  LoopRunShardTestsRequestSchema,
  LoopTestRecordSchema,
  LoopsDoctorResponseSchema,
  LoopsResumeResponseSchema,
  LoopReviewSpecRequestSchema,
  PullLoopImageRequestSchema,
  PullLoopImageResponseSchema,
  UpsertLoopWorkspaceRequestSchema,
  LoopWorkspacesResponseSchema,
} from '../schemas/loops.schema';

const c = initContract();

export const loopsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/issues',
      query: LoopIssuesQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopListResponseSchema),
      },
      summary: 'List Loops issues from the DB index surface',
    },
    listLegacy: {
      method: 'GET',
      path: '/',
      query: LoopIssuesQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopListResponseSchema),
      },
      summary: 'List Loops issues and state (legacy route)',
      deprecated: true,
      description:
        'Deprecated: alias of `list` (`GET /issues`). Kept only for backward compatibility with older clients; new consumers must use `list`. Scheduled for removal in a future version.',
    },
    createIssue: {
      method: 'POST',
      path: '/issues',
      body: CreateLoopIssueRequestSchema,
      responses: {
        201: ApiResponseSchema(LoopIssueCreatedResponseSchema),
      },
      summary: 'Create a Web Issue intake for Loops',
    },
    createSimpleIssue: {
      method: 'POST',
      path: '/issues/simple',
      body: CreateLoopIssueSimpleRequestSchema,
      responses: {
        201: ApiResponseSchema(LoopIssueCreatedResponseSchema),
      },
      summary:
        'Create a Loops issue from a single natural-language request (auto-normalises title/priority/criteria)',
    },
    getIssue: {
      method: 'GET',
      path: '/issues/:issueId',
      pathParams: z.object({
        issueId: z.string(),
      }),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Get a Loops issue detail',
    },
    generateSpec: {
      method: 'POST',
      path: '/issues/:issueId/spec',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Generate an MVP draft spec for a Loops issue',
    },
    reviewSpec: {
      method: 'POST',
      path: '/issues/:issueId/spec/review',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopReviewSpecRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Approve, request revision, or reject a Loops spec',
    },
    decompose: {
      method: 'POST',
      path: '/issues/:issueId/decompose',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Create MVP shards and test annotations for an approved spec',
    },
    runShardTests: {
      method: 'POST',
      path: '/issues/:issueId/shards/:shardId/tests',
      pathParams: z.object({
        issueId: z.string(),
        shardId: z.string(),
      }),
      body: LoopRunShardTestsRequestSchema.optional(),
      responses: {
        200: ApiResponseSchema(LoopTestRecordSchema),
      },
      summary: 'Run test commands for a Loops shard and write a Test Record',
    },
    recordShardImplementation: {
      method: 'POST',
      path: '/issues/:issueId/shards/:shardId/implementation',
      pathParams: z.object({
        issueId: z.string(),
        shardId: z.string(),
      }),
      body: LoopRecordShardImplementationRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopImplementationRecordSchema),
      },
      summary: 'Record implementation evidence for a Loops shard',
    },
    reviewShard: {
      method: 'POST',
      path: '/issues/:issueId/shards/:shardId/review',
      pathParams: z.object({
        issueId: z.string(),
        shardId: z.string(),
      }),
      body: LoopReviewShardRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopReviewRecordSchema),
      },
      summary: 'Review implementation evidence for a Loops shard',
    },
    runLoop: {
      method: 'POST',
      path: '/issues/:issueId/run',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Advance a Loops loop one scheduler step (auto-implement/test/review a ready shard)',
    },
    advance: {
      method: 'POST',
      path: '/issues/:issueId/advance',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary:
        'Advance a Loops issue to the next product-level checkpoint, stopping only for human approval gates',
    },
    reviewGlobal: {
      method: 'POST',
      path: '/issues/:issueId/global-review',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Phase 7: run a Codex global review across all converged shards',
    },
    reloop: {
      method: 'POST',
      path: '/issues/:issueId/reloop',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopReloopRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopReloopResponseSchema),
      },
      summary: 'Phase 7→1: re-loop by bumping spec version after a non-PASS global review',
    },
    naturalCommand: {
      method: 'POST',
      path: '/issues/:issueId/natural-command',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopNaturalCommandRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopNaturalCommandResponseSchema),
      },
      summary: 'Map a deterministic natural-language command to a safe Loops operation',
    },
    finalize: {
      method: 'POST',
      path: '/issues/:issueId/finalize',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Phase 8: terminal annotation refresh, close the issue and emit the convergence PR',
    },
    intervene: {
      method: 'POST',
      path: '/issues/:issueId/interventions',
      pathParams: z.object({
        issueId: z.string(),
      }),
      body: LoopInterventionRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopDetailSchema),
      },
      summary: 'Pause, resume, or take over a Loops issue or shard',
    },
    doctor: {
      method: 'GET',
      path: '/doctor',
      responses: {
        200: ApiResponseSchema(LoopsDoctorResponseSchema),
      },
      summary: 'Check Loops file-backed state consistency',
    },
    cost: {
      method: 'GET',
      path: '/cost',
      responses: {
        200: ApiResponseSchema(LoopCostResponseSchema),
      },
      summary: 'Get Loops cost usage and circuit breaker state',
    },
    metrics: {
      method: 'GET',
      path: '/metrics',
      responses: {
        200: ApiResponseSchema(LoopMetricsResponseSchema),
      },
      summary: 'Get aggregated Loops control-plane metrics',
    },
    capabilities: {
      method: 'GET',
      path: '/capabilities',
      responses: {
        200: ApiResponseSchema(LoopCapabilitiesResponseSchema),
      },
      summary: 'Get the Loops capability registry and planned integration surface',
    },
    agentRuntime: {
      method: 'GET',
      path: '/agent-runtime',
      responses: {
        200: ApiResponseSchema(LoopAgentRuntimeResponseSchema),
      },
      summary: 'Get the current Loops agent runtime status and diagnostics',
    },
    listWorkspaces: {
      method: 'GET',
      path: '/workspaces',
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'List configured Loops workspaces and the active workspace',
    },
    governLearning: {
      method: 'POST',
      path: '/learnings/:learningId/governance',
      pathParams: z.object({
        learningId: z.string(),
      }),
      body: LoopLearningGovernanceRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'Dismiss or merge a Loop learning memory item',
    },
    upsertWorkspace: {
      method: 'POST',
      path: '/workspaces',
      body: UpsertLoopWorkspaceRequestSchema,
      responses: {
        200: ApiResponseSchema(LoopWorkspacesResponseSchema),
      },
      summary: 'Create or update a Loops workspace profile (root, agent modes)',
    },
    detectWorkspaceRuntime: {
      method: 'POST',
      path: '/workspaces/:workspaceId/detect-runtime',
      pathParams: z.object({
        workspaceId: z.string(),
      }),
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(DetectLoopRuntimeResponseSchema),
      },
      summary: 'Probe local CLI + Docker runtimes for a workspace',
    },
    pullWorkspaceImage: {
      method: 'POST',
      path: '/workspaces/:workspaceId/pull-image',
      pathParams: z.object({
        workspaceId: z.string(),
      }),
      body: PullLoopImageRequestSchema,
      responses: {
        200: ApiResponseSchema(PullLoopImageResponseSchema),
      },
      summary: 'Pull the Docker fallback image for an agent in a workspace',
    },
    logs: {
      method: 'GET',
      path: '/logs',
      query: LoopLogsQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopLogsResponseSchema),
      },
      summary: 'Read recent immutable Loops log events',
    },
    notifications: {
      method: 'GET',
      path: '/notifications',
      query: LoopNotificationsQuerySchema,
      responses: {
        200: ApiResponseSchema(LoopNotificationsResponseSchema),
      },
      summary: 'Read recorded Loops notifications',
    },
    resume: {
      method: 'POST',
      path: '/resume',
      body: z.object({}).optional(),
      responses: {
        200: ApiResponseSchema(LoopsResumeResponseSchema),
      },
      summary: 'Recover interrupted Loops shards',
    },
  },
  {
    pathPrefix: '/loops',
  },
);

export type LoopsContract = typeof loopsContract;
