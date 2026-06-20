'use client';

/**
 * SSO cross-subdomain session detection utilities.
 *
 * On page load, vibecoding.dofe.ai can check if the user
 * already has a session at sso.dofe.ai via:
 *   Layer 1: fetch API to /auth/session (same-site, cookie sent automatically)
 *   Layer 2: hidden iframe + postMessage (fallback for strict browser policies)
 *   Layer 3: full OIDC redirect (existing flow, always works)
 *
 * Implementation uses @dofe/sso-browser with local type adaptation.
 * Each layer has a timeout to prevent blocking the UI on slow/unreachable SSO.
 */

import {
  checkSsoSession as checkSsoSessionBase,
  checkSsoSessionViaIframe as checkSsoSessionViaIframeBase,
  type SsoSessionData,
  type SsoTenantInfo,
  type SsoTenantItem,
} from '@dofe/sso-browser';
import type { LoginSuccess } from '@repo/contracts';
import { setCurrentTenantId } from '@/lib/storage';

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || 'https://sso.dofe.ai';

export interface SsoTenantSnapshot {
  currentTenant: SsoTenantInfo | null;
  tenants: SsoTenantItem[];
}

function syncCurrentTenantFromSession(data: SsoSessionData): void {
  if (data.currentTenant?.id) {
    setCurrentTenantId(data.currentTenant.id);
  }
}

/**
 * Adapt SsoSessionData from @dofe/sso-browser to LoginSuccess for project.
 * Maps SsoUserInfo fields to UserInfo with proper defaults for missing fields.
 * Also stores tenant information to localStorage for multi-tenant support.
 */
function adaptToLoginSuccess(data: SsoSessionData): LoginSuccess {
  const ssoUser = data.user;

  syncCurrentTenantFromSession(data);

  return {
    user: {
      id: ssoUser.id,
      code: null,
      nickname: ssoUser.nickname ?? null,
      headerImg: ssoUser.avatar ?? null,
      sex: null,
      isAnonymity: false,
      isAdmin: ssoUser.isAdmin ?? false, // 从 SSO session 获取超级管理员标记
      email: ssoUser.email,
    },
    access: data.access,
    refresh: data.refresh,
    accessExpire: data.accessExpire,
    expire: data.expire,
  };
}

/**
 * Layer 1: Check SSO session via direct fetch API call.
 */
export async function checkSsoSession(): Promise<LoginSuccess | null> {
  const data = await checkSsoSessionBase({ ssoBaseUrl: SSO_BASE_URL, timeoutMs: 3000 });
  return data ? adaptToLoginSuccess(data) : null;
}

/**
 * Layer 2: Check SSO session via hidden iframe + postMessage.
 * Fallback for browsers that block third-party cookies or CORS requests.
 */
export async function checkSsoSessionViaIframe(): Promise<LoginSuccess | null> {
  const data = await checkSsoSessionViaIframeBase({ ssoBaseUrl: SSO_BASE_URL, timeoutMs: 5000 });
  return data ? adaptToLoginSuccess(data) : null;
}

/**
 * Fetch raw SSO session data — includes tenants list and currentTenant info.
 * Uses the same Layer 1 fetch with CORS mode and timeout as checkSsoSession().
 * For use by components that need tenant list or other session metadata beyond
 * the user/token info returned by checkSsoSession().
 */
export async function fetchSsoSessionData(): Promise<SsoSessionData | null> {
  const data = await checkSsoSessionBase({ ssoBaseUrl: SSO_BASE_URL, timeoutMs: 3000 });
  if (data) {
    syncCurrentTenantFromSession(data);
  }
  return data;
}

/**
 * Fetch tenant data from the same SSO session adapter used by auth restore.
 */
export async function fetchSsoTenantSnapshot(): Promise<SsoTenantSnapshot> {
  const data = await fetchSsoSessionData();

  return {
    currentTenant: data?.currentTenant ?? null,
    tenants: data?.tenants ?? [],
  };
}
