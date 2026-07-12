'use client';

import { useSyncExternalStore } from 'react';

const subscribeToMount = () => () => undefined;
const getClientMountSnapshot = () => true;
const getServerMountSnapshot = () => false;

interface ClientOnlyProps {
  children: React.ReactNode;
  /** Optional fallback during SSR and before mount. Use to avoid layout shift. */
  fallback?: React.ReactNode;
}

/**
 * Renders children only after the component has mounted on the client.
 * Use to avoid hydration mismatches for components that rely on client-only
 * APIs or generate different markup on server vs client (e.g. Radix UI useId).
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const mounted = useSyncExternalStore(
    subscribeToMount,
    getClientMountSnapshot,
    getServerMountSnapshot,
  );

  if (!mounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
