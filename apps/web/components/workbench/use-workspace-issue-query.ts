'use client';

import { useSearchParams } from 'next/navigation';
import { useLoopsWorkspaces } from '@/lib/api/contracts/hooks';
import { getSelectedWorkspace } from './workspace-context';

/**
 * Resolves the URL-selected worktree to the existing Issue-list repository
 * filter. The URL remains presentation state; the server still validates the
 * selected workspace when a new Issue is created.
 */
export function useWorkspaceIssueQuery() {
  const searchParams = useSearchParams();
  const workspacesQuery = useLoopsWorkspaces();
  const workspaceData = workspacesQuery.data?.body.data;
  const workspace = getSelectedWorkspace(
    workspaceData?.workspaces ?? [],
    searchParams.get('workspace'),
    workspaceData?.current,
  );

  return {
    workspace,
    listQuery: workspace ? { targetRepo: workspace.root } : {},
  };
}
