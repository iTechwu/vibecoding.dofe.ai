import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';

describe('LoopsWorkspaceProfileService (0622 · B2)', () => {
  let workspace: string;
  let service: LoopsWorkspaceProfileService;
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'loops-ws-profile-'));
    writeFileSync(join(workspace, 'package.json'), '{"name":"ws"}');
    writeFileSync(join(workspace, 'turbo.json'), '{"pipeline":{}}');
    previousEnv.LOOPS_WORKSPACE_ROOT = process.env.LOOPS_WORKSPACE_ROOT;
    process.env.LOOPS_WORKSPACE_ROOT = workspace;
    service = new LoopsWorkspaceProfileService();
  });

  afterEach(() => {
    if (previousEnv.LOOPS_WORKSPACE_ROOT === undefined) {
      delete process.env.LOOPS_WORKSPACE_ROOT;
    } else {
      process.env.LOOPS_WORKSPACE_ROOT = previousEnv.LOOPS_WORKSPACE_ROOT;
    }
    rmSync(workspace, { recursive: true, force: true });
  });

  it('returns a default workspace derived from LOOPS_WORKSPACE_ROOT when no profile exists', async () => {
    const result = await service.list();
    expect(result.current).toBe('default');
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0]).toEqual(
      expect.objectContaining({
        workspaceId: 'default',
        root: workspace,
        status: 'VALIDATED',
        isDefault: true,
        selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
      }),
    );
  });

  it('persists an upserted workspace and marks it current with makeDefault', async () => {
    const extra = mkdtempSync(join(tmpdir(), 'loops-ws-extra-'));
    try {
      await service.upsert({
        workspaceId: 'scaffold',
        root: extra,
        makeDefault: true,
        agents: { codex: { mode: 'docker' } },
      });
      const result = await service.list();
      expect(result.current).toBe('scaffold');
      const scaffold = result.workspaces.find((ws) => ws.workspaceId === 'scaffold');
      expect(scaffold?.selected.codex).toBe('docker');
      expect(scaffold?.selected['claude-code']).toBe('local-cli');

      // Profile is written to .loops/runtime/profile.json.
      const persisted = JSON.parse(
        readFileSync(join(workspace, '.loops', 'runtime', 'profile.json'), 'utf8'),
      ) as { current: string; workspaces: Array<{ workspaceId: string }> };
      expect(persisted.current).toBe('scaffold');
      expect(persisted.workspaces.some((ws) => ws.workspaceId === 'scaffold')).toBe(true);
    } finally {
      rmSync(extra, { recursive: true, force: true });
    }
  });

  it('reports ERROR status for a non-existent workspace root', async () => {
    const result = await service.upsert({
      workspaceId: 'ghost',
      root: join(workspace, 'does-not-exist'),
    });
    const ghost = result.workspaces.find((ws) => ws.workspaceId === 'ghost');
    expect(ghost?.status).toBe('ERROR');
  });

  it('pullImage reports failure via the docker client without throwing', async () => {
    // No docker binary available in the test sandbox → expect a failed outcome.
    const outcome = await service.pullImage('default', 'codex');
    expect(outcome.status).toBe('failed');
    expect(outcome.agent).toBe('codex');
    expect(outcome.image).toMatch(/codex-cli/);
  });
});
