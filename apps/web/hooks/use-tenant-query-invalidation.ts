'use client';

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate tenant-scoped server data when the SSO current tenant changes.
 *
 * Backend reads (Loops list/detail/etc.) are filtered by the *verified* SSO
 * tenant (see docs/0712/tenant-team-sso-unique-source), so the same React Query
 * key returns a different result set after a tenant switch. The browser tenant
 * snapshot in localStorage is only a non-authoritative UI hint (see lib/storage),
 * so the cache must be proactively invalidated on any tenant change — same-tab
 * (`currentTenantUpdated`) and cross-tab (`storage`) — otherwise the console
 * keeps showing the previous tenant's data.
 */
const TENANT_STORAGE_KEYS = new Set(['currentTenant', 'currentTenantSnapshot']);

export function useTenantQueryInvalidation(queryClient: QueryClient): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['loops'] });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || TENANT_STORAGE_KEYS.has(event.key)) {
        invalidate();
      }
    };
    window.addEventListener('currentTenantUpdated', invalidate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('currentTenantUpdated', invalidate);
      window.removeEventListener('storage', onStorage);
    };
  }, [queryClient]);
}
