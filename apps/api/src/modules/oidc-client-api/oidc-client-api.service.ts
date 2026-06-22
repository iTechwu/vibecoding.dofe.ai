import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { randomBytes } from 'crypto';
import { Agent, fetch as undiciFetch } from 'undici';
import {
  discovery,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomState,
  randomNonce,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  ClientSecretBasic,
  allowInsecureRequests,
  customFetch,
} from 'openid-client';
import { UserInfoService } from '@app/db';
import { AuditLogService } from '@app/audit-log';
import { RedisService } from '@dofe/infra-redis';
import { apiError } from '@dofe/infra-common';
import { allowInsecureSsoTls } from '../../common/sso-tls.util';
import { CommonErrorCode, UserErrorCode } from '@repo/contracts/errors';
import {
  OIDC_PARAMS_KEY_PREFIX,
  OIDC_PARAMS_EXPIRE_S,
  OIDC_EXCHANGE_CODE_PREFIX,
  OIDC_EXCHANGE_CODE_TTL_S,
  REFRESH_TOKEN_DEFAULT_EXPIRY_MS,
  ACCESS_TOKEN_DEFAULT_EXPIRY_S,
  TOKEN_BLACKLIST_PREFIX,
  isSsoRefreshTokenExpired,
} from '@repo/constants';
import type { Configuration, CustomFetch } from 'openid-client';
import type { Dispatcher } from 'undici';
import { resolveOidcApiBaseUrl, resolveOidcFrontendBaseUrl } from './url-resolver';

const OIDC_CALLBACK_RESULT_PREFIX = 'dofe:oidc:callback-result:';
const OIDC_CALLBACK_RESULT_TTL_S = OIDC_EXCHANGE_CODE_TTL_S;
const OIDC_CALLBACK_RESULT_WAIT_TIMEOUT_MS = 3000;
const OIDC_CALLBACK_RESULT_WAIT_INTERVAL_MS = 100;

@Injectable()
export class OidcClientApiService implements OnModuleInit {
  private config: Configuration | null = null;
  private configReady = false;
  private initPromise: Promise<void> | null = null;
  private readonly insecureSsoDispatcher = new Agent({
    connect: {
      rejectUnauthorized: false,
    },
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly userInfoService: UserInfoService,
    private readonly redisService: RedisService,
    private readonly auditLogService: AuditLogService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.initPromise = this.initClient();
    await this.initPromise.catch(() => {});
  }

  private get issuer(): string {
    return this.configService.get<string>('SSO_ISSUER', '');
  }

  private get internalIssuer(): string {
    return (
      this.configService.get<string>('SSO_INTERNAL_API_URL') ||
      this.configService.get<string>('SSO_API_URL') ||
      ''
    ).replace(/\/+$/, '');
  }

  private get clientId(): string {
    return this.configService.get<string>('SSO_CLIENT_ID', 'vibecoding-dofe-ai');
  }

  private get clientSecret(): string {
    return this.configService.get<string>('SSO_CLIENT_SECRET', '');
  }

  private getErrorDetails(err: unknown): Record<string, unknown> {
    const cause = err instanceof Error ? err.cause : undefined;
    const causeRecord =
      typeof cause === 'object' && cause !== null ? (cause as Record<string, unknown>) : null;

    return {
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : undefined,
      causeCode: causeRecord?.code,
      causeMessage: cause instanceof Error ? cause.message : undefined,
    };
  }

  private rewriteSsoRequestUrl(url: string | URL): URL {
    const originalUrl = url instanceof URL ? url : new URL(url);
    if (!this.internalIssuer) return originalUrl;

    const issuerUrl = new URL(this.issuer);
    if (originalUrl.origin !== issuerUrl.origin) return originalUrl;

    const internalUrl = new URL(this.internalIssuer);
    internalUrl.pathname = originalUrl.pathname;
    internalUrl.search = originalUrl.search;
    internalUrl.hash = originalUrl.hash;
    return internalUrl;
  }

  private readonly ssoInternalFetch: CustomFetch = async (url, options) => {
    const requestUrl = this.rewriteSsoRequestUrl(url);
    const originalUrl = new URL(url);

    if (requestUrl.href !== originalUrl.href) {
      this.logger.debug('Rewriting SSO OIDC server request to internal endpoint', {
        from: originalUrl.origin,
        to: requestUrl.origin,
        path: originalUrl.pathname,
      });
    }

    if (allowInsecureSsoTls() && requestUrl.protocol === 'https:') {
      this.logger.warn('Using insecure TLS for local/test SSO request', {
        host: requestUrl.hostname,
        nodeEnv: this.configService.get<string>('NODE_ENV', 'dev'),
      });
      return undiciFetch(requestUrl, {
        ...options,
        dispatcher: this.insecureSsoDispatcher as Dispatcher,
      }) as unknown as Promise<Response>;
    }

    return fetch(requestUrl, options as unknown as RequestInit);
  };

  private resolveApiBaseUrl(): string {
    return resolveOidcApiBaseUrl(this.configService);
  }

  private resolveFrontendBaseUrl(): string {
    return resolveOidcFrontendBaseUrl(this.configService);
  }

  private get redirectUri(): string {
    return `${this.resolveApiBaseUrl()}/auth/oidc/callback`;
  }

  get callbackFrontendUrl(): string {
    return `${this.resolveFrontendBaseUrl()}/auth/oidc/success`;
  }

  get appBaseUrl(): string {
    return this.resolveFrontendBaseUrl();
  }

  getLogoutUrl(idTokenHint?: string): string {
    const ssoLogoutUrl = new URL(`${this.issuer}/oauth/logout`);
    ssoLogoutUrl.searchParams.set('post_logout_redirect_uri', `${this.appBaseUrl}/login`);
    if (idTokenHint) {
      ssoLogoutUrl.searchParams.set('id_token_hint', idTokenHint);
    }
    return ssoLogoutUrl.toString();
  }

  private async initClient(): Promise<void> {
    try {
      const issuerUrl = new URL(this.issuer);
      const discoveryOptions =
        issuerUrl.protocol === 'http:' ? { execute: [allowInsecureRequests] } : undefined;

      this.config = await discovery(
        issuerUrl,
        this.clientId,
        {
          client_secret: this.clientSecret,
          redirect_uris: [this.redirectUri],
        },
        ClientSecretBasic(this.clientSecret),
        {
          ...discoveryOptions,
          [customFetch]: this.ssoInternalFetch,
        },
      );
      this.configReady = true;
      this.logger.info('OIDC client initialized successfully', {
        issuer: this.issuer,
        internalIssuer: this.internalIssuer || undefined,
        clientId: this.clientId,
      });
    } catch (err) {
      this.configReady = false;
      this.logger.error('OIDC client initialization failed, will retry on next request', {
        issuer: this.issuer,
        ...this.getErrorDetails(err),
      });
    }
  }

  /**
   * Lazy init with retry: if client is not ready, attempt re-init once.
   * Reuses any in-flight init promise to avoid concurrent initialization.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.configReady && this.config) return;

    // Reuse any in-flight initialization from onModuleInit or a previous call
    if (this.initPromise) {
      await this.initPromise;
      if (this.configReady && this.config) return;
    }

    this.logger.info('OIDC client not ready, attempting lazy initialization');
    this.initPromise = this.initClient();
    await this.initPromise;

    if (!this.configReady || !this.config) {
      throw apiError(CommonErrorCode.InternalServerError, {
        message:
          'OIDC client not initialized. Check SSO_ISSUER and SSO_CLIENT_SECRET configuration.',
      });
    }
  }

  async getAuthorizationUrl(redirectUri?: string): Promise<{ url: string; state: string }> {
    await this.ensureInitialized();

    const state = randomState();
    const nonce = randomNonce();
    const codeVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

    await this.redisService.set(
      `${OIDC_PARAMS_KEY_PREFIX}${state}`,
      { nonce, codeVerifier, redirectUri },
      { EX: OIDC_PARAMS_EXPIRE_S },
    );

    const url = buildAuthorizationUrl(this.config!, {
      scope: 'openid profile email tenant offline_access',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: this.redirectUri,
    });

    this.logger.info('Generated OIDC authorize URL', { state });

    return { url: url.toString(), state };
  }

  /**
   * Handle OIDC callback — exchange code for tokens, find/create local user,
   * then generate a one-time exchange code for frontend to retrieve tokens securely.
   */
  async handleCallback(code: string, state: string): Promise<{ redirectUrl: string }> {
    const completed = await this.getCompletedCallbackResult(state);
    if (completed) {
      return completed;
    }

    const params = await this.validateAndConsumeState(state);
    if (!params) {
      const retryCompleted = await this.waitForCompletedCallbackResult(state);
      if (retryCompleted) {
        return retryCompleted;
      }

      throw apiError(CommonErrorCode.SignatureError, {
        message: 'Invalid or expired OIDC state parameter',
      });
    }

    await this.ensureInitialized();

    const callbackUrl = new URL(this.redirectUri);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', state);

    let tokenEndpointResponse: Awaited<ReturnType<typeof authorizationCodeGrant>>;
    try {
      tokenEndpointResponse = await authorizationCodeGrant(this.config!, callbackUrl, {
        expectedNonce: params.nonce,
        expectedState: state,
        pkceCodeVerifier: params.codeVerifier,
      });
    } catch (err) {
      this.logger.error('OIDC token exchange failed', {
        error: err instanceof Error ? err.message : String(err),
        state,
      });
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'Failed to exchange authorization code',
      });
    }

    const claims = tokenEndpointResponse.claims();
    if (!claims) {
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'ID Token missing from token response',
      });
    }

    const ssoUserId = claims.sub;
    if (!ssoUserId) {
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'ID Token missing sub claim',
      });
    }

    const localUser = await this.findOrCreateUserFromSso(claims);

    // Record successful SSO login audit entry (best-effort; must not block login).
    // Only fires on the real token-exchange path (state consumed), so repeated
    // duplicate callbacks do not create duplicate LOGIN audit rows.
    if (localUser) {
      this.auditLogService.logLogin(localUser.id, { ssoSub: ssoUserId }).catch((err) => {
        this.logger.warn('Failed to record login audit log', {
          userId: localUser.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // Generate one-time exchange code and store tokens + user in Redis
    const exchangeCode = randomBytes(32).toString('hex');
    const expiresIn = tokenEndpointResponse.expires_in ?? ACCESS_TOKEN_DEFAULT_EXPIRY_S;
    const now = Date.now();

    const tokenPayload = {
      access_token: tokenEndpointResponse.access_token,
      refresh_token: tokenEndpointResponse.refresh_token ?? undefined,
      expires_in: expiresIn,
      token_type: 'Bearer' as const,
      id_token: tokenEndpointResponse.id_token ?? undefined,
      // Include computed expiry timestamps for frontend
      access_expire: now + expiresIn * 1000,
      expire: now + REFRESH_TOKEN_DEFAULT_EXPIRY_MS,
      callbackState: state,
      // Include user info so frontend doesn't need an extra API call
      user: localUser
        ? {
            id: localUser.id,
            code: localUser.code ?? null,
            nickname: localUser.nickname ?? null,
            headerImg: null,
            sex: localUser.sex ?? null,
            isAnonymity: false,
            isAdmin: localUser.isAdmin ?? false,
            email: localUser.email ?? undefined,
          }
        : undefined,
    };

    await this.redisService.set(`${OIDC_EXCHANGE_CODE_PREFIX}${exchangeCode}`, tokenPayload, {
      EX: OIDC_EXCHANGE_CODE_TTL_S,
    });

    this.logger.info('Generated one-time exchange code for OIDC callback', {
      state,
    });

    const frontendUrl = new URL(this.callbackFrontendUrl);
    frontendUrl.searchParams.set('code', exchangeCode);
    if (params.redirectUri) {
      frontendUrl.searchParams.set('redirect_uri', params.redirectUri);
    }

    const callbackResult = { redirectUrl: frontendUrl.toString() };
    await this.redisService.set(`${OIDC_CALLBACK_RESULT_PREFIX}${state}`, callbackResult, {
      EX: OIDC_CALLBACK_RESULT_TTL_S,
    });

    return callbackResult;
  }

  /**
   * Exchange a one-time code for the stored token payload.
   */
  async exchangeCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    id_token?: string;
    access_expire: number;
    expire: number;
    user?: {
      id: string;
      code: string | null;
      nickname: string | null;
      headerImg: string | null;
      sex: string | null;
      isAnonymity: boolean;
      isAdmin: boolean;
      email?: string;
    };
  }> {
    const redisKey = `${OIDC_EXCHANGE_CODE_PREFIX}${code}`;
    const raw = await this.getAndDeleteRedisValue(redisKey);
    if (!raw) {
      throw apiError(CommonErrorCode.SignatureError, {
        message: 'Invalid or expired exchange code',
      });
    }

    if (typeof raw === 'object' && raw !== null) {
      const data = raw as Record<string, unknown>;
      const callbackState = typeof data.callbackState === 'string' ? data.callbackState : undefined;
      if (callbackState) {
        await this.redisService.del(`${OIDC_CALLBACK_RESULT_PREFIX}${callbackState}`);
      }

      return {
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string | undefined,
        expires_in: data.expires_in as number,
        token_type: data.token_type as string,
        id_token: data.id_token as string | undefined,
        access_expire: data.access_expire as number,
        expire: data.expire as number,
        user: data.user as
          | {
              id: string;
              code: string | null;
              nickname: string | null;
              headerImg: string | null;
              sex: string | null;
              isAnonymity: boolean;
              isAdmin: boolean;
              email?: string;
            }
          | undefined,
      };
    }

    throw apiError(CommonErrorCode.InternalServerError, {
      message: 'Failed to parse exchange code data',
    });
  }

  /**
   * Proxy refresh token request to sso.dofe.ai
   * @throws CommonErrorCode.SessionExpired when refresh_token is expired/invalid (invalid_grant)
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    access_expire: number;
    expire: number;
  }> {
    await this.ensureInitialized();

    const tokenEndpoint = this.config!.serverMetadata().token_endpoint;
    if (!tokenEndpoint) {
      throw apiError(CommonErrorCode.InternalServerError, {
        message: 'Token endpoint not available',
      });
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await this.ssoInternalFetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    });

    if (!res.ok) {
      const errorText = await res.text();

      // Check for OAuth2 refresh_token expiry errors (invalid_grant, invalid_token)
      // These are expected business scenarios - user needs to re-login
      if (isSsoRefreshTokenExpired(errorText)) {
        this.logger.warn('SSO refresh token expired or invalid', {
          status: res.status,
          error: errorText,
        });
        throw apiError(CommonErrorCode.SessionExpired, {
          message: 'Refresh token expired. Please re-login.',
          ssoError: errorText,
        });
      }

      // Other errors are unexpected - log as error
      this.logger.error('SSO token refresh failed', {
        status: res.status,
        error: errorText,
      });
      throw apiError(CommonErrorCode.InternalServerError, {
        message: `Token refresh failed: ${res.status} ${errorText}`,
      });
    }

    const response = await res.json();
    const expiresIn = response.expires_in ?? ACCESS_TOKEN_DEFAULT_EXPIRY_S;
    const now = Date.now();

    this.logger.info('SSO token refreshed successfully');

    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      expires_in: expiresIn,
      token_type: response.token_type ?? 'Bearer',
      access_expire: now + expiresIn * 1000,
      expire: now + REFRESH_TOKEN_DEFAULT_EXPIRY_MS,
    };
  }

  /**
   * Revoke a token by adding its jti to the blacklist.
   */
  async revokeToken(jti: string, expiresAtSeconds: number): Promise<void> {
    const ttl = expiresAtSeconds - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return; // Already expired, no need to blacklist

    await this.redisService.set(`${TOKEN_BLACKLIST_PREFIX}${jti}`, '1', {
      EX: ttl,
    });
    this.logger.info('Token blacklisted', { jti, ttl });
  }

  private async validateAndConsumeState(state: string): Promise<{
    nonce: string;
    codeVerifier: string;
    redirectUri?: string;
  } | null> {
    if (!state) return null;

    const redisKey = `${OIDC_PARAMS_KEY_PREFIX}${state}`;
    const raw = await this.getAndDeleteRedisValue(redisKey);
    if (!raw) return null;

    if (typeof raw === 'object' && raw !== null) {
      return raw as { nonce: string; codeVerifier: string; redirectUri?: string };
    }

    return null;
  }

  private async getCompletedCallbackResult(state: string): Promise<{ redirectUrl: string } | null> {
    if (!state) return null;

    const raw = await this.redisService.get(`${OIDC_CALLBACK_RESULT_PREFIX}${state}`);
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }

    const redirectUrl = (raw as Record<string, unknown>).redirectUrl;
    return typeof redirectUrl === 'string' && redirectUrl ? { redirectUrl } : null;
  }

  private async waitForCompletedCallbackResult(
    state: string,
  ): Promise<{ redirectUrl: string } | null> {
    const deadline = Date.now() + OIDC_CALLBACK_RESULT_WAIT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, OIDC_CALLBACK_RESULT_WAIT_INTERVAL_MS));
      const completed = await this.getCompletedCallbackResult(state);
      if (completed) {
        return completed;
      }
    }

    return null;
  }

  private async getAndDeleteRedisValue(key: string): Promise<unknown | null> {
    try {
      const raw = await this.redisService.redis.call('GETDEL', key);
      return this.parseRedisValue(raw);
    } catch (error) {
      this.logger.warn('Redis GETDEL failed, falling back to Lua atomic GET + DEL', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      const raw = await this.redisService.redis.eval(
        "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
        1,
        key,
      );
      return this.parseRedisValue(raw);
    }
  }

  private parseRedisValue(raw: unknown): unknown | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (Buffer.isBuffer(raw)) {
      return this.parseRedisValue(raw.toString('utf-8'));
    }

    if (typeof raw !== 'string') {
      return raw;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private async findOrCreateUserFromSso(claims: Record<string, unknown>): Promise<{
    id: string;
    code: string | null;
    nickname: string | null;
    headerImg: string | null;
    sex: string | null;
    isAdmin: boolean;
    email?: string;
    ssoSub?: string;
  } | null> {
    const ssoUserId = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const nameClaim = typeof claims.name === 'string' ? claims.name : '';
    const nickClaim = typeof claims.nickname === 'string' ? claims.nickname : '';
    const nickname = nameClaim || nickClaim || 'User';

    if (!ssoUserId) {
      this.logger.error('OIDC claims missing required "sub" field', { claims });
      throw apiError(CommonErrorCode.UnAuthorized, {
        message: 'ID Token missing required sub claim',
      });
    }

    // Try by ssoSub first
    let user = await this.userInfoService.get({ ssoSub: ssoUserId }).catch(() => null);

    if (user) {
      this.logger.info('Found existing user by SSO sub', { userId: user.id });
      return {
        id: user.id,
        code: user.code ?? null,
        nickname: user.nickname ?? null,
        headerImg: null,
        sex: user.sex ?? null,
        isAdmin: user.isAdmin ?? false,
        email: user.email ?? undefined,
        ssoSub: user.ssoSub ?? undefined,
      };
    }

    // Try by user ID (for backward compatibility, some users have id == ssoUserId)
    user = await this.userInfoService.get({ id: ssoUserId }).catch(() => null);

    if (user) {
      this.logger.info('Found existing user by ID matching SSO sub (legacy)', {
        userId: user.id,
      });
      // Backfill ssoSub for legacy users
      try {
        await this.userInfoService.update({ id: user.id }, { ssoSub: ssoUserId });
      } catch {
        /* best-effort backfill */
      }
      return {
        id: user.id,
        code: user.code ?? null,
        nickname: user.nickname ?? null,
        headerImg: null,
        sex: user.sex ?? null,
        isAdmin: user.isAdmin ?? false,
        email: user.email ?? undefined,
        ssoSub: user.ssoSub ?? undefined,
      };
    }

    // Try by email
    if (email) {
      user = await this.userInfoService.get({ email }).catch(() => null);
      if (user) {
        this.logger.info('Found existing user by email from SSO', {
          userId: user.id,
          email,
        });
        // Backfill ssoSub for email-matched users
        try {
          await this.userInfoService.update({ id: user.id }, { ssoSub: ssoUserId });
        } catch {
          /* best-effort backfill */
        }
        return {
          id: user.id,
          code: user.code ?? null,
          nickname: user.nickname ?? null,
          headerImg: null,
          sex: user.sex ?? null,
          isAdmin: user.isAdmin ?? false,
          email: user.email ?? undefined,
          ssoSub: user.ssoSub ?? undefined,
        };
      }
    }

    this.logger.info('Creating new user from SSO OIDC', {
      ssoUserId,
      nickname,
      email,
    });

    // Create new user with ssoSub
    try {
      user = await this.userInfoService.create({
        id: ssoUserId,
        nickname,
        email,
        ssoSub: ssoUserId,
      });
    } catch {
      // Handle race condition - try looking up again
      user = await this.userInfoService.get({ ssoSub: ssoUserId }).catch(() => null);
      if (!user && email) {
        user = await this.userInfoService.get({ email }).catch(() => null);
      }
      if (!user) {
        user = await this.userInfoService.get({ id: ssoUserId }).catch(() => null);
      }
      if (!user) {
        throw apiError(UserErrorCode.UserNotFound, {
          message: 'Failed to create user from SSO',
        });
      }
    }

    return {
      id: user.id,
      code: user.code ?? null,
      nickname: user.nickname ?? null,
      headerImg: null,
      sex: user.sex ?? null,
      isAdmin: user.isAdmin ?? false,
      email: user.email ?? undefined,
      ssoSub: user.ssoSub ?? undefined,
    };
  }
}
