import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiResponseSchema } from '../base';
import { UserErrorCode } from '../errors/domains/user.errors';
import { createTypedErrorResponse } from '../errors/error-response';
import {
  UserCheckResponseSchema,
  UserAccountBaseSchema,
  UserContactResponseSchema,
} from '../schemas/user.schema';

const c = initContract();

/**
 * User API Contract
 */
export const userContract = c.router(
  {
    check: {
      method: 'GET',
      path: '/check',
      responses: {
        200: ApiResponseSchema(UserCheckResponseSchema),
        401: createTypedErrorResponse([UserErrorCode.UserNotFound] as const),
      } as Record<number, z.ZodType>,
      summary: 'Check user info (userId)',
    },

    getInfo: {
      method: 'GET',
      path: '/info',
      responses: {
        200: ApiResponseSchema(UserAccountBaseSchema),
        401: createTypedErrorResponse([UserErrorCode.UserNotFound] as const),
      } as Record<number, z.ZodType>,
      summary: 'Get user account info',
    },

    getContact: {
      method: 'GET',
      path: '/contact/:userId',
      pathParams: z.object({
        userId: z.string().uuid(),
      }),
      responses: {
        200: ApiResponseSchema(UserContactResponseSchema),
        400: createTypedErrorResponse([UserErrorCode.UserNotFound] as const),
      } as Record<number, z.ZodType>,
      summary: 'Get user contact info by userId',
    },
  },
  {
    pathPrefix: '/user',
  },
);

export type UserContract = typeof userContract;
