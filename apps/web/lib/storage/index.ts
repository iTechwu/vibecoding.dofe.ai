'use client';

/**
 * 统一的 localStorage 存储管理模块
 * 细粒度存储，避免数据冗余，支持独立更新
 */

import type { UserInfo, LoginSuccess } from '@repo/contracts';
import { REFRESH_TOKEN_DEFAULT_EXPIRY_MS } from '@dofe/sso-contracts/token';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Token 数据
 */
export interface TokenData {
  access: string;
  accessExpire: number;
  expire?: number;
  /** @deprecated refresh_token is stored in HttpOnly cookie (dofe_rf). */
  refresh?: string;
}

/**
 * 存储键名常量
 */
const STORAGE_KEYS = {
  USER: 'user',
  TOKENS: 'tokens',
  ID_TOKEN: 'idToken',
  CURRENT_TENANT: 'currentTenant',
  CURRENT_TENANT_SNAPSHOT: 'currentTenantSnapshot',
} as const;

export interface TenantSnapshot {
  tenantId: string;
  tenantName?: string;
  teamId?: string;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + maxAgeSeconds * 1000);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `max-age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    `expires=${expires.toUTCString()}`,
    'path=/',
    'SameSite=Lax',
  ];
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const parts = [
    `${name}=`,
    'max-age=0',
    'expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'path=/',
    'SameSite=Lax',
  ];
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * 存储用户信息
 */
export function setUser(user: UserInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  window.dispatchEvent(new Event('userInfoUpdated'));
}

/**
 * 获取用户信息
 */
export function getUser(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as UserInfo;
  } catch {
    return null;
  }
}

/**
 * 更新用户信息（部分更新）
 */
export function updateUser(updates: Partial<UserInfo>): void {
  const currentUser = getUser();
  if (!currentUser) return;
  setUser({ ...currentUser, ...updates });
}

/**
 * 存储 Token 数据
 */
export function setTokens(tokens: TokenData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));

  const sessionExpire = tokens.expire ?? Date.now() + REFRESH_TOKEN_DEFAULT_EXPIRY_MS;
  const maxAgeSeconds = Math.max(1, Math.ceil((sessionExpire - Date.now()) / 1000));
  setCookie('tokenPresence', '1', maxAgeSeconds);
  setCookie('tokenExpire', String(tokens.accessExpire), maxAgeSeconds);
}

/**
 * 获取 Token 数据
 */
export function getTokens(): TokenData | null {
  if (typeof window === 'undefined') return null;
  const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);
  if (!tokensStr) return null;
  try {
    return JSON.parse(tokensStr) as TokenData;
  } catch {
    return null;
  }
}

/**
 * 获取 Access Token
 */
export function getAccessToken(): string | null {
  const tokens = getTokens();
  return tokens?.access || null;
}

/**
 * 获取 Refresh Token
 */
export function getRefreshToken(): string | null {
  return null;
}

/**
 * 检查 Access Token 是否过期
 */
export function isTokenExpired(): boolean {
  const tokens = getTokens();
  if (!tokens?.accessExpire) return true;
  if (tokens.expire && Date.now() >= normalizeTimestampMs(tokens.expire)) return true;
  return Date.now() >= normalizeTimestampMs(tokens.accessExpire);
}

export function isSessionExpired(): boolean {
  const tokens = getTokens();
  if (!tokens?.expire) return true;
  return Date.now() >= normalizeTimestampMs(tokens.expire);
}

function normalizeTimestampMs(value: number): number {
  return value < 10000000000 ? value * 1000 : value;
}

export function setIdToken(idToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
}

export function getIdToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
}

/**
 * 存储登录数据（统一入口）
 * 将登录返回的数据拆分为细粒度存储
 */
export function setLoginData(data: LoginSuccess): void {
  if (typeof window === 'undefined') return;

  // 存储用户信息
  setUser(data.user);

  // 存储 Token 数据
  setTokens({
    access: data.access,
    accessExpire: data.accessExpire,
    expire: data.expire,
  });
}

/**
 * 清除所有存储数据
 */
export function clearAll(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKENS);
  localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT_SNAPSHOT);

  deleteCookie('tokenPresence');
  deleteCookie('tokenExpire');
  deleteCookie('accessToken');
  deleteCookie('refreshToken');

  // 清除旧格式的数据（兼容性清理）
  localStorage.removeItem('userInfo');
  localStorage.removeItem('tokenData');
  localStorage.removeItem('loginData');
  localStorage.removeItem('token');
}

// ============================================================================
// Tenant Storage Operations
// ============================================================================

export function setCurrentTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return;
  // Match the readable snapshot + legacy read path: an empty/whitespace tenant
  // id is not a valid selection, so reject it instead of persisting state that
  // getCurrentTenantSnapshot would then have to silently drop on read.
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) return;
  localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, trimmed);
  window.dispatchEvent(new Event('currentTenantUpdated'));
}

export function getCurrentTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT) || '';
}

export function setCurrentTenantSnapshot(snapshot: TenantSnapshot): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, snapshot.tenantId);
  localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_SNAPSHOT, JSON.stringify(snapshot));
  window.dispatchEvent(new Event('currentTenantUpdated'));
}

export function getCurrentTenantSnapshot(): TenantSnapshot | null {
  if (typeof window === 'undefined') return null;
  const snapshotStr = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_SNAPSHOT);
  if (snapshotStr) {
    try {
      const parsed = JSON.parse(snapshotStr) as Partial<TenantSnapshot>;
      if (typeof parsed.tenantId === 'string' && parsed.tenantId.trim().length > 0) {
        return {
          tenantId: parsed.tenantId.trim(),
          ...(typeof parsed.tenantName === 'string' && parsed.tenantName.trim().length > 0
            ? { tenantName: parsed.tenantName.trim() }
            : {}),
          ...(typeof parsed.teamId === 'string' && parsed.teamId.trim().length > 0
            ? { teamId: parsed.teamId.trim() }
            : {}),
        };
      }
    } catch {
      // Fall back to the legacy tenant id below.
    }
  }
  const tenantId = getCurrentTenantId().trim();
  return tenantId.length > 0 ? { tenantId } : null;
}

export function clearCurrentTenantId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT_SNAPSHOT);
  window.dispatchEvent(new Event('currentTenantUpdated'));
}

// ============================================================================
// Backward Compatibility (临时兼容旧代码)
// ============================================================================

/**
 * 获取 Token（兼容旧代码）
 */
export function getToken(): string | null {
  return getAccessToken();
}
