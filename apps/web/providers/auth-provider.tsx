'use client';

/**
 * Auth Context Provider
 *
 * Provides authentication state and methods throughout the application.
 * Manages user info, tokens, login/logout functionality.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import type { UserInfo, LoginSuccess } from '@repo/contracts';
import {
  getUser,
  getTokens,
  clearAll,
  isTokenExpired,
  isSessionExpired,
  setLoginData,
  getAccessToken,
  getIdToken,
} from '@/lib/storage';
import { oidcAuthClient } from '@/lib/api/contracts/client';
import { tokenManager, SessionExpiredError } from '@/lib/token-manager';
import { prefetchDashboardData } from '@/lib/api/prefetch';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AuthContextType {
  // State
  user: UserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;

  // Actions
  login: (data: LoginSuccess) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ============================================================================
// Context Creation
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

function extractLogoutUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const logoutUrl = (data as { logoutUrl?: unknown }).logoutUrl;
  return typeof logoutUrl === 'string' ? logoutUrl : null;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize user from localStorage; refresh expired access tokens through
  // the RP HttpOnly refresh cookie instead of a local refresh token.
  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        const tokens = getTokens();
        if (tokens && isSessionExpired()) {
          clearAll();
        } else if (tokens?.access && isTokenExpired()) {
          await tokenManager.refreshToken();
        }

        const storedUser = getUser();
        if (!cancelled) {
          setUserState(storedUser);
        }

        if (storedUser) {
          prefetchDashboardData().catch((error) => {
            logger.warn('Failed to prefetch dashboard data on init:', error);
          });
        }
      } catch (error) {
        logger.warn('Initial SSO token refresh failed, clearing local session:', error);
        clearAll();
        if (!cancelled) {
          setUserState(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    // Listen for user info updates from other components
    const handleUserUpdate = () => {
      const updatedUser = getUser();
      setUserState(updatedUser);
    };

    window.addEventListener('userInfoUpdated', handleUserUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('userInfoUpdated', handleUserUpdate);
    };
  }, []);

  // Login: store user and access token metadata. refresh_token is HttpOnly.
  const login = useCallback((data: LoginSuccess) => {
    setLoginData(data);
    setUserState(getUser());
    // Prefetch dashboard data after successful login
    prefetchDashboardData().catch((error) => {
      logger.warn('Failed to prefetch dashboard data:', error);
    });
  }, []);

  // Logout: revoke access token, clear HttpOnly refresh cookie, clear storage, and redirect to SSO logout.
  const logout = useCallback(async () => {
    const accessToken = getAccessToken();
    const idTokenHint = getIdToken();
    let ssoLogoutUrl: string | null = null;

    if (accessToken) {
      try {
        const res = await oidcAuthClient.logout({
          body: {
            access_token: accessToken,
            id_token_hint: idTokenHint || undefined,
          },
        });
        ssoLogoutUrl = extractLogoutUrl(res.body);
      } catch (error) {
        logger.warn('SSO logout with token revocation failed:', error);
      }
    }

    if (!ssoLogoutUrl) {
      try {
        const res = await oidcAuthClient.getLogoutUrl({
          query: { id_token_hint: idTokenHint || undefined },
        });
        ssoLogoutUrl = extractLogoutUrl(res.body);
      } catch (error) {
        logger.warn('SSO logout URL fetch failed:', error);
      }
    }

    try {
      await oidcAuthClient.clearSession({ body: {} });
    } catch {
      // Best-effort: local cleanup still happens below.
    }

    clearAll();
    setUserState(null);

    if (ssoLogoutUrl) {
      window.location.href = ssoLogoutUrl;
    } else {
      router.push('/login');
    }
  }, [router]);

  // Refresh user info from server using tokenManager; refresh_token remains in HttpOnly cookie.
  const refreshUser = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens?.access) {
      return;
    }

    try {
      await tokenManager.refreshToken();
      setUserState(getUser());
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        clearAll();
        setUserState(null);
        router.push('/login?reason=session_expired');
        return;
      }
      logger.error('Failed to refresh user:', error);
    }
  }, [router]);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!user) return;

    const checkAndRefresh = () => {
      if (isTokenExpired()) {
        refreshUser();
      }
    };

    const interval = setInterval(checkAndRefresh, 60000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && !isTokenExpired(),
    isAdmin: user?.isAdmin ?? false,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to get current user ID
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

/**
 * Hook to check if current user is admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useAuth();
  return isAdmin;
}
