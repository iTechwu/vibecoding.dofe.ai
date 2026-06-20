'use client';

/**
 * [SSO-LOGIN-REDESIGN] Unified Token Manager
 *
 * Uses @dofe/sso-browser TokenManager with project-specific adapters.
 * @see sso.dofe.ai/docs/0517/sso-login-redesign.md
 *
 * StorageAdapter: Uses vibecoding.dofe.ai storage (localStorage + cookie)
 * RefreshClient: Uses oidcAuthClient.ts-rest + userClient.ts-rest
 */

import {
  createTokenManager,
  type StorageAdapter,
  type RefreshClient,
} from '@dofe/sso-browser/token-manager';
import { z } from 'zod';
import { UserInfoSchema, type UserInfo, type LoginSuccess } from '@repo/contracts';
import { oidcAuthClient, userClient } from './api/contracts/client';
import {
  setLoginData as storageSetLoginData,
  getAccessToken,
  getTokens as storageGetTokens,
  setTokens as storageSetTokens,
  setUser as storageSetUser,
  getUser as storageGetUser,
  clearAll,
  isTokenExpired as storageIsTokenExpired,
} from './storage';

// ============================================================================
// Custom Error Types
// ============================================================================

/**
 * Error thrown when session is expired and user needs to re-login.
 * This is a business-expected scenario, not a system error.
 */
export class SessionExpiredError extends Error {
  constructor(message: string = 'Session expired. Please re-login.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

// ============================================================================
// API Response Schemas (for type-safe parsing)
// ============================================================================

/**
 * Token refresh API response schema
 */
const RefreshResponseSchema = z.object({
  code: z.number().optional(),
  msg: z.string().optional(),
  data: z
    .object({
      access_token: z.string(),
      expires_in: z.number().optional().default(3600),
      token_type: z.string().optional(),
      access_expire: z.number().optional(),
      expire: z.number().optional(),
      user: UserInfoSchema.optional(),
    })
    .optional(),
});

/**
 * API error response schema (for detecting SessionExpired)
 */
const ErrorResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  msg: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
  data: z.unknown().optional(),
  error: z
    .object({
      errorCode: z.union([z.string(), z.number()]).optional(),
      errorType: z.string().optional(),
    })
    .optional(),
});

/**
 * User check API response schema
 */
const UserCheckResponseSchema = z.object({
  code: z.number().optional(),
  msg: z.string().optional(),
  data: UserInfoSchema.optional(),
});

/**
 * Auth error codes that indicate session expiry (from @repo/contracts/errors)
 */
const SESSION_EXPIRED_CODES = ['305410', '929410'] as const;
type SessionExpiredCode = (typeof SESSION_EXPIRED_CODES)[number];
const SESSION_EXPIRED_MESSAGES = [
  'No refresh token available',
  'Refresh token expired',
  'Session expired',
] as const;

// ============================================================================
// Types (re-export for backward compatibility)
// ============================================================================

/** @deprecated Use LoginSuccess from @repo/contracts instead */
export type LoginData = LoginSuccess;
export type { TokenData } from './storage';
export type { TokenRefreshResult } from '@dofe/sso-browser/token-manager';

// ============================================================================
// StorageAdapter Implementation
// ============================================================================

/**
 * vibecoding.dofe.ai storage adapter.
 * Stores access token in cookie for middleware + localStorage for client.
 */
const vibecodingStorageAdapter: StorageAdapter = {
  getAccessToken(): string | null {
    return getAccessToken();
  },

  getTokens() {
    const tokens = storageGetTokens();
    if (!tokens) return null;
    return {
      access: tokens.access,
      accessExpire: tokens.accessExpire,
      expire: tokens.expire,
    };
  },

  setTokens(tokens) {
    storageSetTokens({
      access: tokens.access,
      accessExpire: tokens.accessExpire,
      expire: tokens.expire ?? tokens.accessExpire, // fallback to accessExpire if expire is undefined
    });
  },

  setUser(user: UserInfo) {
    storageSetUser(user);
  },

  getUser(): UserInfo | null {
    return storageGetUser();
  },

  clearAll() {
    clearAll();
  },

  isTokenExpired(): boolean {
    return storageIsTokenExpired();
  },
};

// ============================================================================
// RefreshClient Implementation
// ============================================================================

/**
 * Check if the response indicates a session expired error.
 */
function isSessionExpiredResponse(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) return false;

  const body = (response as { body?: unknown }).body ?? response;
  const parsed = ErrorResponseSchema.safeParse(body);
  if (!parsed.success) return false;

  // Check for session expired error codes
  const errorCode = parsed.data.error?.errorCode ?? parsed.data.code;
  if (errorCode && SESSION_EXPIRED_CODES.includes(String(errorCode) as SessionExpiredCode)) {
    return true;
  }

  const message = parsed.data.msg ?? parsed.data.message;
  const messageText = Array.isArray(message) ? message.join('\n') : message;
  if (
    typeof messageText === 'string' &&
    SESSION_EXPIRED_MESSAGES.some((expiredMessage) => messageText.includes(expiredMessage))
  ) {
    return true;
  }

  // Also check HTTP status codes that indicate auth failure
  const status = (response as { status?: unknown }).status;
  if (status === 401 || status === 410) {
    return true;
  }

  return false;
}

/**
 * vibecoding.dofe.ai API client adapter.
 * Uses ts-rest oidcAuthClient and userClient with Zod validation.
 */
const vibecodingRefreshClient: RefreshClient = {
  async refreshToken() {
    const response = await oidcAuthClient.refreshToken({
      body: {},
    });

    // Check for session expired errors
    if (isSessionExpiredResponse(response)) {
      throw new SessionExpiredError('Session expired. Please re-login.');
    }

    if (response.status !== 200) {
      const parsed = RefreshResponseSchema.safeParse(response.body);
      const msg = parsed.success && parsed.data.msg ? parsed.data.msg : 'Token refresh failed';
      throw new Error(msg);
    }

    const parsed = RefreshResponseSchema.safeParse(response.body);
    if (!parsed.success) {
      throw new Error('Invalid token refresh response format');
    }

    if (!parsed.data.data?.access_token) {
      throw new Error('No access token in refresh response');
    }

    const data = parsed.data.data;
    return {
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
      user: data.user,
    };
  },

  async fetchUser(): Promise<UserInfo | null> {
    try {
      const response = await userClient.check();
      if (response.status === 200 && response.body) {
        const parsed = UserCheckResponseSchema.safeParse(response.body);
        if (parsed.success && parsed.data.data) {
          return parsed.data.data;
        }
      }
    } catch {
      // Return existing user if fetch fails
    }
    return storageGetUser();
  },
};

// ============================================================================
// TokenManager Singleton
// ============================================================================

const tokenManager = createTokenManager(vibecodingStorageAdapter, vibecodingRefreshClient);

// ============================================================================
// Backward-compatible function exports
// ============================================================================

export const getToken = () => tokenManager.getToken();
export const isTokenExpired = () => tokenManager.isTokenExpired();
export const clearToken = () => tokenManager.clearToken();
export const refreshToken = () => tokenManager.refreshToken();
export const ensureValidToken = () => tokenManager.ensureValidToken();

/**
 * Set login data (backward-compatible wrapper).
 * Uses storage directly for full LoginSuccess data.
 */
export function setTokenData(data: LoginData): void {
  if (typeof window === 'undefined') return;
  storageSetLoginData(data);
}

// ============================================================================
// Export singleton for direct access
// ============================================================================

export { tokenManager };

// ============================================================================
// Export types from sso-browser
// ============================================================================

export type { TokenUpdateCallback } from '@dofe/sso-browser/token-manager';
