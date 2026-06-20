/**
 * SSO / OIDC Authentication Constants
 */

/** Default refresh token expiry (30 days in ms) */
export const REFRESH_TOKEN_DEFAULT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/** Default access token expiry (1 hour in seconds) */
export const ACCESS_TOKEN_DEFAULT_EXPIRY_S = 3600;

/** OIDC exchange code Redis key prefix */
export const OIDC_EXCHANGE_CODE_PREFIX = 'dofe:oidc:exchange:';

/** OIDC exchange code TTL (seconds) — short-lived one-time code
 *  [SSO-LOGIN-REDESIGN] 延长到 5 分钟（300s），覆盖页面加载延迟、React hydration、网络请求
 *  @see sso.dofe.ai/docs/0517/sso-login-redesign.md
 */
export const OIDC_EXCHANGE_CODE_TTL_S = 300;

/** OIDC params Redis key prefix (state/nonce/codeVerifier) */
export const OIDC_PARAMS_KEY_PREFIX = 'dofe:oidc:params:';

/** OIDC params Redis TTL (seconds) */
export const OIDC_PARAMS_EXPIRE_S = 600;

/** Token blacklist Redis key prefix */
export const TOKEN_BLACKLIST_PREFIX = 'dofe:token:blacklist:';

/** Token refresh window (milliseconds)
 *  [SSO-LOGIN-REDESIGN] 在 access_token 过期前多久开始刷新
 *  默认：5 分钟（5 * 60 * 1000）
 */
export const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;

/** Session check debounce interval (milliseconds)
 *  [SSO-LOGIN-REDESIGN] 防止 visibilitychange 触发频繁检查
 *  默认：5 秒（5000）
 */
export const SESSION_CHECK_DEBOUNCE_MS = 5000;

/**
 * SSO Refresh Token 错误码（OAuth2 标准）
 * 当 refresh_token 过期/无效时，SSO 返回这些错误
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
 */
export const SSO_REFRESH_TOKEN_ERRORS = {
  /** refresh_token 过期或已被撤销 */
  INVALID_GRANT: 'invalid_grant',
  /** refresh_token 无效（格式错误、不存在等） */
  INVALID_TOKEN: 'invalid_token',
} as const;

/**
 * 检测是否为 SSO refresh token 失效错误
 * @param errorBody SSO 返回的错误体（JSON 字符串或对象）
 * @returns true 表示 refresh token 已失效，需要重新登录
 */
export function isSsoRefreshTokenExpired(errorBody: string | Record<string, unknown>): boolean {
  let error: string | undefined;
  if (typeof errorBody === 'string') {
    try {
      const parsed = JSON.parse(errorBody);
      error = parsed.error;
    } catch {
      return false;
    }
  } else {
    error = errorBody.error as string | undefined;
  }
  return (
    error === SSO_REFRESH_TOKEN_ERRORS.INVALID_GRANT ||
    error === SSO_REFRESH_TOKEN_ERRORS.INVALID_TOKEN
  );
}
