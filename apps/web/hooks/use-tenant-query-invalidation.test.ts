import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useTenantQueryInvalidation } from './use-tenant-query-invalidation';

describe('useTenantQueryInvalidation', () => {
  it('invalidates loops queries when currentTenantUpdated fires (same tab)', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useTenantQueryInvalidation(queryClient));
    window.dispatchEvent(new Event('currentTenantUpdated'));

    expect(spy).toHaveBeenCalledWith({ queryKey: ['loops'] });
  });

  it('invalidates on a cross-tab storage event for tenant keys', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useTenantQueryInvalidation(queryClient));
    window.dispatchEvent(new StorageEvent('storage', { key: 'currentTenant' }));

    expect(spy).toHaveBeenCalledWith({ queryKey: ['loops'] });
  });

  it('does not invalidate on unrelated storage keys', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useTenantQueryInvalidation(queryClient));
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('removes listeners on unmount', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = renderHook(() => useTenantQueryInvalidation(queryClient));
    unmount();
    window.dispatchEvent(new Event('currentTenantUpdated'));

    expect(spy).not.toHaveBeenCalled();
  });
});
