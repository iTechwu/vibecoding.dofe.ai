import { Controller, Get, Query, Res, Req, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { oidcAuthContract as c } from '@repo/contracts';
import { success } from '@dofe/infra-common/ts-rest';
import { Public } from '@app/auth';
import { AuditLogService } from '@app/audit-log';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import {
  DOFE_RF_COOKIE,
  DOFE_RF_MAX_AGE,
  getCookieDomain,
  isSecureCookieRequired,
  classifyRefreshError,
} from '@dofe/sso-nestjs';
import { OidcClientApiService } from './oidc-client-api.service';
import { CommonErrorCode } from '@repo/contracts/errors';
import { apiError } from '@dofe/infra-common';

const nodeEnv = process.env.NODE_ENV;

@Controller()
@Public()
export class OidcClientApiController {
  constructor(
    private readonly oidcClientService: OidcClientApiService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // ==========================================================================
  // Cookie helpers — delegates to @dofe/sso-nestjs
  // ==========================================================================

  private setRefreshCookie(reply: FastifyReply, value: string, maxAge: number): void {
    reply.setCookie(DOFE_RF_COOKIE, value, {
      httpOnly: true,
      secure: isSecureCookieRequired(nodeEnv),
      sameSite: 'lax',
      domain: getCookieDomain(nodeEnv),
      path: '/',
      maxAge,
    });
  }

  private getRefreshCookie(request: FastifyRequest): string | undefined {
    return (request.cookies as Record<string, string> | undefined)?.[DOFE_RF_COOKIE];
  }

  /**
   * GET /auth/oidc/authorize
   * 获取 SSO OIDC 授权 URL
   */
  @TsRestHandler(c.getAuthorizeUrl)
  async getAuthorizeUrl() {
    return tsRestHandler(c.getAuthorizeUrl, async ({ query }) => {
      const result = await this.oidcClientService.getAuthorizationUrl(query.redirect_uri);
      return success(result);
    });
  }

  /**
   * GET /auth/oidc/callback
   * SSO 回调处理 — 验证 state + 交换 code + 创建用户 + 生成一次性 code + 302 重定向前端
   */
  @Get('/auth/oidc/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (error) {
      this.logger.warn('OIDC callback received error', {
        error,
        errorDescription,
        state,
      });
      const frontendUrl = new URL(this.oidcClientService.callbackFrontendUrl);
      frontendUrl.searchParams.set('error', error);
      if (errorDescription) {
        frontendUrl.searchParams.set('error_description', errorDescription);
      }
      reply.redirect(frontendUrl.toString(), 302);
      return;
    }

    if (!code || !state) {
      this.logger.warn('OIDC callback missing required params');
      const errorUrl = new URL(this.oidcClientService.callbackFrontendUrl);
      errorUrl.searchParams.set('error', 'invalid_request');
      errorUrl.searchParams.set('error_description', 'Missing required OAuth parameters');
      reply.redirect(errorUrl.toString(), 302);
      return;
    }

    try {
      const result = await this.oidcClientService.handleCallback(code, state);
      reply.redirect(result.redirectUrl, 302);
    } catch (err) {
      this.logger.error('OIDC callback handling failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      const errorUrl = new URL(this.oidcClientService.callbackFrontendUrl);
      errorUrl.searchParams.set('error', 'server_error');
      errorUrl.searchParams.set('error_description', 'Failed to complete authentication');
      reply.redirect(errorUrl.toString(), 302);
    }
  }

  /**
   * POST /auth/oidc/exchange
   * 用一次性授权码换取 SSO Token
   * refresh_token 通过 HttpOnly cookie (dofe_rf) 返回，不在响应体中出现
   */
  @TsRestHandler(c.exchangeCode)
  async exchangeCode(@Res({ passthrough: true }) reply: FastifyReply) {
    return tsRestHandler(c.exchangeCode, async ({ body }) => {
      const result = await this.oidcClientService.exchangeCode(body.code);

      if (result.refresh_token) {
        this.setRefreshCookie(reply, result.refresh_token, DOFE_RF_MAX_AGE);
      }

      const { refresh_token: _, ...rest } = result;
      return success(rest);
    });
  }

  /**
   * GET /auth/oidc/logout
   * 获取 SSO 退出登录 URL
   */
  @TsRestHandler(c.getLogoutUrl)
  async getLogoutUrl() {
    return tsRestHandler(c.getLogoutUrl, async ({ query }) => {
      const logoutUrl = this.oidcClientService.getLogoutUrl(query.id_token_hint);
      return success({ logoutUrl });
    });
  }

  /**
   * POST /auth/oidc/token
   * 刷新 SSO Token（服务端代理，保护 client_secret）
   * refresh_token 仅从 HttpOnly cookie (dofe_rf) 读取，不接受请求体传递
   */
  @TsRestHandler(c.refreshToken)
  async refreshToken(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return tsRestHandler(c.refreshToken, async () => {
      const refreshTokenStr = this.getRefreshCookie(req);
      if (!refreshTokenStr) {
        throw apiError(CommonErrorCode.SessionExpired, {
          message: 'No refresh token available. Please re-login.',
        });
      }

      try {
        const result = await this.oidcClientService.refreshToken(refreshTokenStr);

        // Refresh is an active-session signal. Extend the RP HttpOnly cookie
        // even when SSO does not rotate the refresh token.
        this.setRefreshCookie(reply, result.refresh_token ?? refreshTokenStr, DOFE_RF_MAX_AGE);

        const { refresh_token: _, ...rest } = result;
        return success(rest);
      } catch (err) {
        // Use SDK error classification for consistent cookie cleanup
        const classified = classifyRefreshError(err);
        if (classified.isTokenInvalid) {
          this.setRefreshCookie(reply, '', 0); // Clear cookie
        }
        throw err; // Re-throw for ts-rest to handle error response
      }
    });
  }

  /**
   * POST /auth/oidc/logout
   * 撤销 Token + 获取 SSO 退出登录 URL
   */
  @TsRestHandler(c.logout)
  async logout() {
    return tsRestHandler(c.logout, async ({ body }) => {
      let decodedToken: Record<string, unknown> | null = null;
      // Decode JWT payload to extract jti/exp for token blacklisting.
      // We use jwt.decode (no signature verification) because at logout
      // the token may already be expired — we just need its claims.
      // The blacklist is defense-in-depth; the real revocation happens
      // at the SSO provider via the logout redirect.
      try {
        decodedToken = this.jwtService.decode(body.access_token, {
          complete: false,
        }) as Record<string, unknown> | null;
        if (decodedToken) {
          const jti = typeof decodedToken.jti === 'string' ? decodedToken.jti : undefined;
          const exp = typeof decodedToken.exp === 'number' ? decodedToken.exp : undefined;
          if (jti && exp) {
            await this.oidcClientService.revokeToken(jti, exp);
          }
        }
      } catch (err) {
        this.logger.warn('Failed to decode access token for blacklisting', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      await this.recordLogoutAudit(decodedToken);

      const logoutUrl = this.oidcClientService.getLogoutUrl(body.id_token_hint);
      return success({ logoutUrl });
    });
  }

  /**
   * POST /auth/oidc/clear-session
   * 清除 dofe_rf HttpOnly cookie，用于前端登出时清理服务端会话
   */
  @TsRestHandler(c.clearSession)
  async clearSession(@Res({ passthrough: true }) reply: FastifyReply) {
    return tsRestHandler(c.clearSession, async () => {
      this.setRefreshCookie(reply, '', 0);
      return success({ success: true });
    });
  }

  private async recordLogoutAudit(decodedToken: Record<string, unknown> | null): Promise<void> {
    const actorId = this.resolveActorIdFromToken(decodedToken);
    if (!actorId) {
      this.logger.warn('Skipped logout audit log because access token has no user claim');
      return;
    }

    try {
      await this.auditLogService.logLogout(actorId, {
        ssoSub: typeof decodedToken?.sub === 'string' ? decodedToken.sub : undefined,
        source: 'oidc.logout',
      });
    } catch (error) {
      this.logger.warn('Failed to record logout audit log', {
        actorId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private resolveActorIdFromToken(decodedToken: Record<string, unknown> | null): string | null {
    if (!decodedToken) return null;
    const candidates = [decodedToken.userId, decodedToken.uid, decodedToken.sub];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate;
      }
    }
    return null;
  }
}
