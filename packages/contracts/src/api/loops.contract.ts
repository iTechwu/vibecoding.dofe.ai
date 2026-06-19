import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiResponseSchema } from '../base';
import {
  CreateLoopIssueRequestSchema,
  LoopCostResponseSchema,
  LoopDetailSchema,
  LoopInterventionRequestSchema,
  LoopImplementationRecordSchema,
  LoopIssueCreatedResponseSchema,
  LoopListResponseSchema,
  LoopLogsQuerySchema,
  LoopLogsResponseSchema,
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
} from '../schemas/loops.schema';

const c = initContract();

export const loopsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      responses: {
        200: ApiResponseSchema(LoopListResponseSchema),
      },
      summary: 'List Loops issues and state',
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
