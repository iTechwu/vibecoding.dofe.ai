import { FastifyRequest } from 'fastify';
import { z } from 'zod';

/**
 * Auth context schema (validated shape extracted from JWT).
 */
export const AuthContextSchema = z.object({
  userId: z.string(),
  isAdmin: z.boolean().optional(),
  isAnonymity: z.boolean().optional(),
  openid: z.string().optional(),
});

export type AuthContext = z.infer<typeof AuthContextSchema>;

/**
 * Decoded JWT user info schema.
 */
export const AuthUserInfoSchema = z.object({
  id: z.string(),
  nickname: z.string().optional(),
  code: z.string().optional(),
  headerImg: z.string().optional(),
  sex: z.string().optional(),
  planExpireAt: z.string().optional(),
  isAdmin: z.boolean(),
  isAnonymity: z.boolean(),
  openid: z.string().optional(),
});

export type AuthUserInfo = z.infer<typeof AuthUserInfoSchema>;

/**
 * Typed request for authenticated endpoints.
 *
 * Narrowing of the optional FastifyRequest augmentation properties
 * (declared in `src/types/fastify.d.ts`) to their required equivalents.
 * Use this in controller methods that are guaranteed to run behind AuthGuard.
 *
 * The underlying property types come from the Fastify module augmentation,
 * so this interface only narrows `optional -> required` for the fields that
 * AuthGuard always sets before the handler runs.
 */
export interface AuthenticatedRequest extends FastifyRequest {
  /** User ID guaranteed to be present (set by AuthGuard). */
  userId: string;

  /** Admin flag guaranteed to be present (set by AuthGuard). */
  isAdmin: boolean;

  /** Anonymity flag guaranteed to be present (set by AuthGuard). */
  isAnonymity: boolean;

  /** Decoded user info guaranteed to be present (set by AuthGuard). */
  userInfo: AuthUserInfo;
}
