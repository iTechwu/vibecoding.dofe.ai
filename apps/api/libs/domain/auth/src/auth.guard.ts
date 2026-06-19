import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { CommonErrorCode } from '@repo/contracts/errors';
import { apiError } from '@dofe/infra-common';
import { ConfigService } from '@nestjs/config';
import { stringUtil, environmentUtil } from '@dofe/infra-utils';
import { FastifyRequest } from 'fastify';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { MPTRAIL_HEADER } from '@repo/constants';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly outOfAnonymityPathConfig: Record<string, string[]>;
  private readonly outOfUserPathConfig: Record<string, string[]>;

  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.outOfAnonymityPathConfig =
      this.config.getOrThrow<Record<string, string[]>>('outOfAnonymityPath');
    this.outOfUserPathConfig =
      this.config.getOrThrow<Record<string, string[]>>('outOfUserPath');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const requestMethod = request.method.toLowerCase();
    const requestPath = stringUtil.trimSlashes(
      stringUtil.splitString(request.url, '?')[0],
    );

    // 检查是否在白名单路径中
    if (
      this.outOfUserPathConfig[requestMethod]?.some((pattern: string) =>
        new RegExp(`^${pattern.replace(/:\w+/g, '[^/]+')}$`).test(
          requestPath.replace('api/', ''),
        ),
      )
    ) {
      return true;
    }

    // 从方法处理器获取元数据
    let authTypes = this.reflector.get<string[]>('auths', context.getHandler());
    if (!authTypes) {
      authTypes = this.reflector.get<string[]>('auths', context.getClass());
    }

    const [authType = 'api', guardType = 'api'] = authTypes || ['api', 'api'];
    const isMpTest = request.headers[MPTRAIL_HEADER] === 'true';
    let userId,
      isAdmin = false,
      isAnonymity = false;

    if (!process.env.MODE_USER_ID) {
      let access;
      if (guardType === 'sse') {
        access = decodeURIComponent((request.query as Record<string, string>)['access_token']);
      } else {
        access = this.auth.extractTokenFromHeader(request);
        if (!access) {
          throw apiError(CommonErrorCode.UnAuthorized);
        }
      }
      if (!access) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      let payload;
      try {
        const secret = this.config.getOrThrow<string>('JWT_SECRET');
        payload = await this.jwt.verifyAsync(access, {
          secret,
        });
      } catch (error) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      userId = payload?.sub;
      isAnonymity = payload?.isAnonymity;
      isAdmin = payload?.isAdmin;

      if (isAnonymity) {
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      // 将 JWT payload 中的用户信息设置到 request 中
      request.userInfo = {
        id: userId,
        nickname: payload?.nickname,
        code: payload?.code,
        headerImg: payload?.headerImg,
        sex: payload?.sex,
        isAdmin: isAdmin,
        isAnonymity: isAnonymity,
      };
    } else {
      if (process.env.NODE_ENV === 'prod') {
        this.logger.error(
          'CRITICAL SECURITY ERROR: MODE_USER_ID is set in prod environment!',
        );
        throw apiError(CommonErrorCode.UnAuthorized);
      }

      this.logger.warn(
        'Auth Guard is running in insecure bypass mode. DO NOT USE IN PROD.',
        { bypassUserId: process.env.MODE_USER_ID },
      );

      userId = process.env.MODE_USER_ID;
      isAdmin = true;
      isAnonymity = false;
    }

    if (!userId) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (
      request.method.toLowerCase() === 'post' &&
      process.env?.PREVIEW_MODE === 'true' &&
      // FastifyRequest version mismatch between scaffold pnpm store and infra package node_modules
      // Runtime types are compatible across Fastify 5.x minor versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      environmentUtil.isWeChatMiniProgram(request as any) &&
      isMpTest &&
      process.env?.PREVIEW_USER_ID
    ) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (authType === 'admin' && !isAdmin) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    // 检查匿名用户访问限制
    if (
      this.outOfAnonymityPathConfig[requestMethod]?.some((pattern: string) =>
        new RegExp(`^${pattern.replace(/:\w+/g, '[^/]+')}$`).test(
          requestPath.replace('api/', ''),
        ),
      ) &&
      isAnonymity
    ) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    // 将用户信息设置到request对象中
    request.userId = userId;
    request.isAnonymity = isAnonymity;
    request.isAdmin = isAdmin;

    return true;
  }
}
