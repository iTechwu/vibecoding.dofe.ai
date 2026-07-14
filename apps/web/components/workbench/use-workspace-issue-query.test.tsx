import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceIssueQuery } from './use-workspace-issue-query';

const state = vi.hoisted(() => ({
  workspaceId: 'api',
  current: 'web',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ workspace: state.workspaceId }),
}));

vi.mock('@/lib/api/contracts/hooks', () => ({
  useLoopsWorkspaces: () => ({
    data: {
      body: {
        data: {
          current: state.current,
          workspaces: [
            { workspaceId: 'web', root: '/code/storefront', isDefault: true },
            { workspaceId: 'api', root: '/code/api-service', isDefault: false },
          ],
        },
      },
    },
  }),
}));

describe('useWorkspaceIssueQuery', () => {
  beforeEach(() => {
    state.workspaceId = 'api';
    state.current = 'web';
  });

  it('uses the requested workspace root to scope Issue list queries', () => {
    const { result } = renderHook(() => useWorkspaceIssueQuery());

    expect(result.current.workspace?.workspaceId).toBe('api');
    expect(result.current.listQuery).toEqual({ targetRepo: '/code/api-service' });
  });

  it('falls back to the active workspace when the URL workspace is unknown', () => {
    state.workspaceId = 'missing';

    const { result } = renderHook(() => useWorkspaceIssueQuery());

    expect(result.current.workspace?.workspaceId).toBe('web');
    expect(result.current.listQuery).toEqual({ targetRepo: '/code/storefront' });
  });
});
