import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiResponseSchema } from '../base';
import { CommonErrorCode } from '../errors/domains/common.errors';
import { createTypedErrorResponse } from '../errors/error-response';
import {
  DownloadFileResponseSchema,
  BatchDownloadRequestSchema,
  BatchDownloadResponseSchema,
} from '../schemas/download.schema';

const c = initContract();

/**
 * Download API Contract
 *
 * RESTful Changes from V1:
 * - GET /files/:fileId (was POST /space/:spaceId/file/:fileId/:operationType)
 * - POST /batch (unchanged path, cleaner body)
 */
export const downloadContract = c.router(
  {
    getFile: {
      method: 'GET',
      path: '/spaces/:spaceId/files/:fileId/op',
      pathParams: z.object({
        spaceId: z.string().uuid(),
        fileId: z.string().uuid(),
      }),
      query: z.object({
        operationType: z
          .enum(['fileViewOp', 'fileDownloadOp'])
          .optional()
          .default('fileDownloadOp'),
      }),
      responses: {
        200: ApiResponseSchema(DownloadFileResponseSchema),
        401: createTypedErrorResponse([CommonErrorCode.UnAuthorized] as const),
      } as Record<number, z.ZodType>,
      summary: 'Get download URL for a single file',
    },
    batchDownload: {
      method: 'POST',
      path: '/batch',
      body: BatchDownloadRequestSchema,
      responses: {
        200: ApiResponseSchema(BatchDownloadResponseSchema),
        401: createTypedErrorResponse([CommonErrorCode.UnAuthorized] as const),
      } as Record<number, z.ZodType>,
      summary: 'Get download URL for multiple files',
    },
  },
  {
    pathPrefix: '/download',
  },
);

export type DownloadContract = typeof downloadContract;
