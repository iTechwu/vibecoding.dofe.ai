'use client';

/**
 * Auth Context Provider
 *
 * Provides authentication state and methods throughout the application.
 * Manages user info, tokens, login/logout functionality.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import type { UserInfo, LoginSuccess } from '@repo/contracts';
import {
  getUser,
  setUser,
  getTokens,
  setTokens,
  clearAll,
  isTokenExpired,
} from '@/lib/storage';
import { signClient } from '@/lib/api/contracts/client';
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize user from localStorage on mount and prefetch dashboard data
  useEffect(() => {
    const storedUser = getUser();
    if (storedUser) {
      setUserState(storedUser);
      // Prefetch dashboard data for returning authenticated users
      prefetchDashboardData().catch((error) => {
        logger.warn('Failed to prefetch dashboard data on init:', error);
      });
    }
    setIsLoading(false);

    // Listen for user info updates from other components
    const handleUserUpdate = () => {
      const updatedUser = getUser();
      setUserState(updatedUser);
    };

    window.addEventListener('userInfoUpdated', handleUserUpdate);
    return () => {
      window.removeEventListener('userInfoUpdated', handleUserUpdate);
    };
  }, []);

  // Login: store user and tokens, then prefetch dashboard data
  const login = useCallback((data: LoginSuccess) => {
    // Store user (merges with existing data if any)
    setUser(data.user);
    setTokens({
      access: data.access,
      refresh: data.refresh,
      accessExpire: data.accessExpire,
      expire: data.expire,
    });
    // Get the merged user from storage for state
    const mergedUser = getUser();
    setUserState(mergedUser);
    // Prefetch dashboard data after successful login
    prefetchDashboardData().catch((error) => {
      logger.warn('Failed to prefetch dashboard data:', error);
    });
  }, []);

  // Logout: clear storage and redirect
  const logout = useCallback(async () => {
    try {
      // Call sign out endpoint
      await signClient.signOut({
        body: {},
      });
    } catch (error) {
      // Ignore errors during logout
      logger.warn('Sign out API call failed:', error);
    } finally {
      // Clear local storage
      clearAll();
      setUserState(null);
      // Redirect to login page
      router.push('/login');
    }
  }, [router]);

  // Refresh user info from server
  const refreshUser = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens?.refresh) {
      return;
    }

    try {
      const response = await signClient.refreshToken({
        query: { refresh: tokens.refresh },
      });

      if (response.status === 200 && response.body.data) {
        const data = response.body.data;
        // Store user (merges with existing data)
        setUser(data.user);
        setTokens({
          access: data.access,
          refresh: data.refresh,
          accessExpire: data.accessExpire,
          expire: data.expire,
        });
        // Get the merged user from storage for state
        const mergedUser = getUser();
        setUserState(mergedUser);
      }
    } catch (error) {
      logger.error('Failed to refresh user:', error);
    }
  }, []);

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
