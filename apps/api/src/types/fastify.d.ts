/**
 * Fastify Request type augmentation.
 *
 * Extends the FastifyRequest interface with authentication and context
 * properties that are injected by guards, middleware, or interceptors at
 * runtime. All properties are optional because unauthenticated endpoints
 * (e.g. health-check, public webhooks) will never have them set.
 *
 * For controller methods behind AuthGuard, use the `AuthenticatedRequest`
 * type exported from `@app/auth` which asserts these fields as required.
 */
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated user ID (set by AuthGuard / StreamingAsrSessionGuard). */
    userId?: string;

    /** Whether the authenticated user is an admin (set by AuthGuard). */
    isAdmin?: boolean;

    /** Whether the user is anonymous (set by AuthGuard). */
    isAnonymity?: boolean;

    /** Decoded JWT user info (set by AuthGuard). */
    userInfo?: {
      id: string;
      nickname?: string;
      code?: string;
      headerImg?: string;
      sex?: string;
      isAdmin: boolean;
      isAnonymity: boolean;
      openid?: string;
    };

    /** Streaming ASR session ID (set by StreamingAsrSessionGuard). */
    sessionId?: string;

    /** Team ID for multi-tenant scoping. */
    teamId?: string;

    /** Tenant ID for multi-tenant scoping. */
    tenantId?: string;

    /** Distributed trace ID for request tracing. */
    traceId?: string;

    /** Resolved locale for i18n. */
    locale?: string;

    /** Real client IP (behind proxies). */
    realIp?: string;
  }
}
