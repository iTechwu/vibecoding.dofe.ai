import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiResponseSchema } from '../base';
import {
  CreateLoopIssueRequestSchema,
  LoopDetailSchema,
  LoopIssueCreatedResponseSchema,
  LoopListResponseSchema,
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
  },
  {
    pathPrefix: '/loops',
  },
);

export type LoopsContract = typeof loopsContract;
