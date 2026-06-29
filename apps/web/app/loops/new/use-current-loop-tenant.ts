'use client';

import { useEffect, useState } from 'react';
import { getCurrentTenantSnapshot } from '@/lib/storage';

export function useCurrentLoopTenant() {
  const [tenantContext, setTenantContext] = useState(() => getCurrentTenantSnapshot());

  useEffect(() => {
    const sync = () => setTenantContext(getCurrentTenantSnapshot());
    sync();
    window.addEventListener('currentTenantUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('currentTenantUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return tenantContext ?? undefined;
}
