import type { LoginSuccess, UserInfo } from '@repo/contracts';
import { setLoginData, getAccessToken, getRefreshToken as getRefresh, clearAll } from './storage';
import { tokenManager } from './token-manager';

// Re-export types from contracts
export type User = UserInfo;
export type LoginData = LoginSuccess;

export interface LoginResponse {
  code: number;
  msg: string;
  data: LoginData;
}

export interface RefreshTokenResponse {
  code: number;
  msg: string;
  data: LoginData;
}

export interface TokenData {
  access: string;
  refresh: string;
  accessExpire: number;
  expire: number;
}

// ============================================================================
// Token Management
// ============================================================================

// 获取存储的 token（使用新的存储模块）
export function getToken(): string | null {
  return getAccessToken();
}

// 获取 refresh token（使用新的存储模块）
export function getRefreshToken(): string | null {
  return getRefresh();
}

// 检查 access token 是否过期（使用新的存储模块）
export function isTokenExpired(): boolean {
  return tokenManager.isTokenExpired();
}

// 设置 token 数据（使用新的存储模块）
export function setTokenData(data: LoginData): void {
  if (typeof window !== 'undefined') {
    setLoginData(data);
  }
}

// 清除 token（使用新的存储模块）
export function clearToken(): void {
  clearAll();
}

/**
 * 刷新 Token（通过 tokenManager 调用 /auth/oidc/token，refresh_token 在 HttpOnly cookie 中）
 */
export async function refreshToken(): Promise<LoginData> {
  return tokenManager.refreshToken() as Promise<LoginData>;
}

/**
 * 确保 token 有效（如果过期则自动刷新）
 */
export async function ensureValidToken(): Promise<string> {
  return tokenManager.ensureValidToken();
}

// 注意：文件上传功能已移至 lib/upload/uploader.ts
// 请使用 uploadFile 函数从 lib/upload/uploader 导入
