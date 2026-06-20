import { z } from 'zod';

/**
 * User-related Zod schemas
 */

// User check response
export const UserCheckResponseSchema = z.object({
  userId: z.string().uuid(),
});

// User account base schema. Local auth/provider account tables are not exposed;
// authentication and provider identities are owned by sso.dofe.ai.
export const UserAccountBaseSchema = z.object({
  id: z.string().uuid(),
  code: z.string().optional().nullable(),
  nickname: z.string().optional().nullable(),
  headerImg: z.string().url().optional().nullable(),
  sex: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  ssoSub: z.string().optional().nullable(),
});

// User contact response schema
export const UserContactResponseSchema = z.object({
  userId: z.string().uuid(),
  nickname: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
});
