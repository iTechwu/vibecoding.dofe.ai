import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  clearCurrentTenantId,
  getCurrentTenantSnapshot,
  setCurrentTenantSnapshot,
} from './index';

describe('tenant storage', () => {
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

  it('returns a normalized tenant snapshot when storage is valid', () => {
    setCurrentTenantSnapshot({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });

    expect(getCurrentTenantSnapshot()).toEqual({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });
  });

  it('dispatches tenant update events when setting a readable tenant snapshot', () => {
    const listener = vi.fn();
    window.addEventListener('currentTenantUpdated', listener);

    try {
      setCurrentTenantSnapshot({
        tenantId: 'tenant-youhuitun',
        tenantName: '优惠豚',
        teamId: 'team-1',
      });
    } finally {
      window.removeEventListener('currentTenantUpdated', listener);
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed tenant snapshots and falls back to the legacy tenant id', () => {
    window.localStorage.setItem('currentTenant', 'tenant-fallback');
    window.localStorage.setItem(
      'currentTenantSnapshot',
      JSON.stringify({ tenantId: 123, tenantName: 'Invalid tenant' }),
    );

    expect(getCurrentTenantSnapshot()).toEqual({ tenantId: 'tenant-fallback' });
  });

  it('ignores a whitespace-only legacy tenant id, matching the snapshot path', () => {
    window.localStorage.setItem('currentTenant', '   ');

    expect(getCurrentTenantSnapshot()).toBeNull();
  });

  it('trims a padded legacy tenant id when falling back from a malformed snapshot', () => {
    window.localStorage.setItem('currentTenant', '  tenant-padded  ');
    window.localStorage.setItem(
      'currentTenantSnapshot',
      JSON.stringify({ tenantId: { nested: true } }),
    );

    expect(getCurrentTenantSnapshot()).toEqual({ tenantId: 'tenant-padded' });
  });

  it('returns null when both the snapshot and legacy tenant id are unusable', () => {
    window.localStorage.setItem(
      'currentTenantSnapshot',
      JSON.stringify({ tenantId: { nested: true }, tenantName: 'Invalid tenant' }),
    );

    expect(getCurrentTenantSnapshot()).toBeNull();
  });

  it('clears both legacy tenant id and readable tenant snapshot', () => {
    setCurrentTenantSnapshot({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });

    clearCurrentTenantId();

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('currentTenant');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('currentTenantSnapshot');
    expect(getCurrentTenantSnapshot()).toBeNull();
  });

  it('dispatches tenant update events when clearing the current tenant', () => {
    setCurrentTenantSnapshot({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });
    const listener = vi.fn();
    window.addEventListener('currentTenantUpdated', listener);

    try {
      clearCurrentTenantId();
    } finally {
      window.removeEventListener('currentTenantUpdated', listener);
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clearAll removes tenant snapshot state with the rest of the browser session', () => {
    setCurrentTenantSnapshot({
      tenantId: 'tenant-youhuitun',
      tenantName: '优惠豚',
      teamId: 'team-1',
    });

    clearAll();

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('currentTenant');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('currentTenantSnapshot');
  });
});
