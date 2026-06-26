import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiError } from '@dofe/infra-common';
import { environmentUtil } from '@dofe/infra-utils';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { CommonErrorCode } from '@repo/contracts/errors';
import { MPTRAIL_HEADER } from '@dofe/infra-contracts';
import {
  DofeSsoAuthGuardBase,
  SSO_AUTH_HOOKS,
  SSO_AUTH_OPTIONS,
  SSO_TOKEN_VERIFIER,
  type SsoTokenVerifier,
  type SsoAuthGuardOptions,
  type SsoAuthGuardHooks,
} from '@dofe/sso-nestjs';
import type { SsoAuthClient } from '@dofe/infra-clients/sso';
import { IS_PUBLIC_KEY } from './auth';

/**
 * Vibecoding AuthGuard — extends the SDK base with project-specific logic.
 *
 * Project-specific additions handled here:
 * - MODE_USER_ID development bypass
 * - WeChat mini-program preview rejection
 *
 * Common flow delegated to DofeSsoAuthGuardBase:
 * - @Public() bypass
 * - Token extraction (Bearer / SSE)
 * - SSO verify + blacklist check
 * - Local user resolution
 * - Admin flag + request identity
 * - auth type guard (api/admin)
 */
@Injectable()
export class AuthGuard extends DofeSsoAuthGuardBase {
  constructor(
    @Inject(SSO_AUTH_HOOKS) hooks: SsoAuthGuardHooks,
    @Inject(SSO_TOKEN_VERIFIER) verifier: SsoTokenVerifier,
    @Inject(SSO_AUTH_OPTIONS) options: SsoAuthGuardOptions,
    reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: Logger,
  ) {
    super(hooks, verifier, options, reflector);
  }

  /**
   * Override the SDK base's authError to throw the project's canonical
   * `apiError(CommonErrorCode.UnAuthorized)` (ApiException → HTTP 401).
   *
   * The base's default generic Error would otherwise be mapped to 500 by the
   * global exception filter (`@dofe/infra-common` HttpExceptionFilter), breaking
   * the frontend 401→re-login flow. Keeps base-thrown failures (missing/invalid/
   * revoked token, admin-required) consistent with the MODE_USER_ID/WeChat paths.
   */
  protected authError(_message: string): Error {
    return apiError(CommonErrorCode.UnAuthorized);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // ── MODE_USER_ID dev bypass ──
    if (process.env.MODE_USER_ID) {
      if (process.env.NODE_ENV === 'prod') {
        this.winstonLogger.error(
          'CRITICAL SECURITY ERROR: MODE_USER_ID is set in prod environment',
        );
        throw apiError(CommonErrorCode.UnAuthorized);
      }
      this.winstonLogger.warn('AuthGuard is running in insecure bypass mode. DO NOT USE IN PROD.', {
        bypassUserId: process.env.MODE_USER_ID,
      });
      request.userId = process.env.MODE_USER_ID;
      request.isAdmin = true;
      request.userInfo = { id: request.userId, isAdmin: true, isAnonymity: false };
      return true;
    }

    // ── Delegate standard auth flow to SDK base ──
    const result = await super.canActivate(context);

    // ── WeChat mini-program preview rejection ──
    if (
      request.method?.toLowerCase() === 'post' &&
      process.env?.PREVIEW_MODE === 'true' &&
      environmentUtil.isWeChatMiniProgram(request as never) &&
      request.headers?.[MPTRAIL_HEADER] === 'true' &&
      process.env?.PREVIEW_USER_ID
    ) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    return result;
  }
}
