import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SsoAuthClient } from '@dofe/infra-clients/sso';
import { apiError } from '@dofe/infra-common';
import { environmentUtil } from '@dofe/infra-utils';
import { RedisService } from '@dofe/infra-redis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { CommonErrorCode } from '@repo/contracts/errors';
import { MPTRAIL_HEADER, TOKEN_BLACKLIST_PREFIX } from '@repo/constants';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './auth';
import { UserSyncService } from './user-sync.service';
import type { AuthenticatedRequest } from './types/auth.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly ssoAuth: SsoAuthClient,
    private readonly userSync: UserSyncService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    let authTypes = this.reflector.get<string[]>('auths', context.getHandler());
    if (!authTypes) {
      authTypes = this.reflector.get<string[]>('auths', context.getClass());
    }

    const [authType = 'api', guardType = 'api'] = authTypes || ['api', 'api'];
    const isMpTest = request.headers[MPTRAIL_HEADER] === 'true';

    let userId: string | undefined;
    let isAdmin = false;
    let isAnonymity = false;

    if (!process.env.MODE_USER_ID) {
      const access =
        guardType === 'sse'
          ? decodeURIComponent((request.query as Record<string, string>)['access_token'] ?? '')
          : this.auth.extractTokenFromHeader(request);

      if (!access) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      await this.assertTokenNotBlacklisted(access);

      const verifyResult = await this.ssoAuth.verifyToken(access);
      if (!verifyResult.valid || !verifyResult.userId) {
        this.logger.warn('AuthGuard token verification failed via SSO');
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      const localUser = await this.userSync.ensureLocalUserExists(verifyResult.userId);
      userId = localUser.id;
      isAdmin = localUser.isAdmin ?? false;
      isAnonymity = false;
      request.userInfo = {
        id: localUser.id,
        nickname: localUser.nickname ?? undefined,
        code: localUser.code ?? undefined,
        headerImg: undefined,
        sex: localUser.sex ?? undefined,
        isAdmin,
        isAnonymity,
      };
    } else {
      if (process.env.NODE_ENV === 'prod') {
        this.logger.error('CRITICAL SECURITY ERROR: MODE_USER_ID is set in prod environment');
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      this.logger.warn('AuthGuard is running in insecure bypass mode. DO NOT USE IN PROD.', {
        bypassUserId: process.env.MODE_USER_ID,
      });
      userId = process.env.MODE_USER_ID;
      isAdmin = true;
      isAnonymity = false;
      request.userInfo = {
        id: userId,
        isAdmin,
        isAnonymity,
      };
    }

    if (!userId) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (
      request.method.toLowerCase() === 'post' &&
      process.env?.PREVIEW_MODE === 'true' &&
      environmentUtil.isWeChatMiniProgram(request as never) &&
      isMpTest &&
      process.env?.PREVIEW_USER_ID
    ) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (authType === 'admin' && !isAdmin) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    request.userId = userId;
    request.isAdmin = isAdmin;
    request.isAnonymity = isAnonymity;

    return true;
  }

  private async assertTokenNotBlacklisted(accessToken: string): Promise<void> {
    let blacklistedJti: string | undefined;

    try {
      const decoded = this.jwtService.decode(accessToken, {
        complete: false,
      }) as Record<string, unknown> | null;
      const jti = typeof decoded?.jti === 'string' ? decoded.jti : undefined;
      if (!jti) return;

      const blacklisted = await this.redisService.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
      if (blacklisted) {
        blacklistedJti = jti;
      }
    } catch (error) {
      this.logger.warn('AuthGuard token blacklist check failed; falling back to SSO verify', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (blacklistedJti) {
      this.logger.warn('AuthGuard rejected blacklisted access token', { jti: blacklistedJti });
      throw apiError(CommonErrorCode.UnAuthorized);
    }
  }
}
