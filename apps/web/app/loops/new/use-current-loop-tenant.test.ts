import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCurrentTenantId, setCurrentTenantSnapshot } from '@/lib/storage';
import { useCurrentLoopTenant } from './use-current-loop-tenant';

describe('useCurrentLoopTenant', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => store.get(key) ?? null);
    vi.mocked(window.localStorage.setItem).mockImplementation((key, value) => {
      store.set(key, value);
    });
    vi.mocked(window.localStorage.removeItem).mockImplementation((key) => {
      store.delete(key);
    });
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      store.clear();
    });
  });

  it('returns undefined until a tenant snapshot is available', () => {
    const { result } = renderHook(() => useCurrentLoopTenant());

    expect(result.current).toBeUndefined();
  });

  it('refreshes when the current tab sets a tenant snapshot', () => {
    const { result } = renderHook(() => useCurrentLoopTenant());

    act(() => {
      setCurrentTenantSnapshot({
        tenantId: 'tenant-youhuitun',
        tenantName: '优惠豚',
        teamId: 'team-1',
      });
    });

    expect(result.current).toEqual({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });
  });

  it('refreshes from a storage event after another tab updates the tenant', () => {
    const { result } = renderHook(() => useCurrentLoopTenant());

    act(() => {
      window.localStorage.setItem(
        'currentTenantSnapshot',
        JSON.stringify({
          tenantId: 'tenant-youhuitun',
          tenantName: '优惠豚',
        }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'currentTenantSnapshot' }));
    });

    expect(result.current).toEqual({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
    });
  });

  it('clears the visible tenant when the current tab clears tenant state', () => {
    const { result } = renderHook(() => useCurrentLoopTenant());

    act(() => {
      setCurrentTenantSnapshot({
        tenantId: 'tenant-youhuitun',
        tenantName: '优惠豚',
      });
    });

    expect(result.current).toEqual({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
    });

    act(() => {
      clearCurrentTenantId();
    });

    expect(result.current).toBeUndefined();
  });
});
