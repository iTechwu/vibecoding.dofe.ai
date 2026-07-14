import type { LoopWorkspaceSummary } from '@repo/contracts';

export function workspaceLabel(
  workspace: Pick<LoopWorkspaceSummary, 'workspaceId' | 'root'>,
): string {
  const segments = workspace.root.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments.at(-1) || workspace.workspaceId;
}

export function getSelectedWorkspace(
  workspaces: LoopWorkspaceSummary[],
  requestedWorkspaceId: string | null,
  currentWorkspaceId: string | undefined,
): LoopWorkspaceSummary | undefined {
  return (
    workspaces.find((workspace) => workspace.workspaceId === requestedWorkspaceId) ??
    workspaces.find((workspace) => workspace.workspaceId === currentWorkspaceId) ??
    workspaces.find((workspace) => workspace.isDefault) ??
    workspaces[0]
  );
}
