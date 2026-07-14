import type { LoopWorkspaceSummary } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { getSelectedWorkspace, workspaceLabel } from './workspace-context';

const workspaces = [
  {
    workspaceId: 'web',
    root: '/code/storefront',
    status: 'READY',
    isDefault: true,
    selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
  },
  {
    workspaceId: 'api',
    root: '/code/api-service',
    status: 'SELECTED',
    isDefault: false,
    selected: { codex: 'docker', 'claude-code': 'local-cli' },
  },
] satisfies LoopWorkspaceSummary[];

describe('workspace context', () => {
  it('uses the last root segment as the workspace label', () => {
    expect(workspaceLabel(workspaces[0]!)).toBe('storefront');
  });

  it('prefers a valid requested workspace and falls back to the current workspace', () => {
    expect(getSelectedWorkspace(workspaces, 'api', 'web')?.workspaceId).toBe('api');
    expect(getSelectedWorkspace(workspaces, 'unknown', 'web')?.workspaceId).toBe('web');
  });
});
