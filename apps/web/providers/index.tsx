'use client';

/**
 * Providers Index - Combined Providers
 * 统一的 Providers 组合
 */

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import NextTopLoader from 'nextjs-toploader';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';
import { AppProvider } from './app-provider';
import { AuthProvider } from './auth-provider';
import { RuntimeI18nBridge } from '@/components/runtime-i18n-bridge';

export { QueryProvider } from './query-provider';
export { ThemeProvider } from './theme-provider';
export { AppProvider, useApp } from './app-provider';
export {
  AuthProvider,
  useAuth,
  useIsAuthenticated,
  useUserId,
  useIsAdmin,
} from './auth-provider';
export { IntlClientProvider } from './intl-client-provider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers Component
 * 根 Providers 组件
 *
 * Combines all providers in the correct order:
 * 1. AppProvider - Application context (brand, version)
 * 2. ThemeProvider - Theme management (dark/light mode)
 * 3. AuthProvider - Authentication state and methods
 * 4. QueryProvider - React Query
 * 5. UI components (Toaster, TopLoader)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <AppProvider>
      <ThemeProvider>
        <AuthProvider>
          <NextTopLoader color="#000" showSpinner={false} height={2} />
          <Toaster
            position="top-center"
            richColors
            closeButton
            duration={4000}
          />
          <RuntimeI18nBridge />
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppProvider>
  );
}

export default Providers;
