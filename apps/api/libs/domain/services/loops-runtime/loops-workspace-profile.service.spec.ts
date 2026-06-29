import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { LoopsDockerClient } from './loops-docker.client';
import { LoopsWorkspaceProfileService } from './loops-workspace-profile.service';

describe('LoopsWorkspaceProfileService (0622 · B2)', () => {
  let workspace: string;
  let service: LoopsWorkspaceProfileService;
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'loops-ws-profile-'));
    writeFileSync(join(workspace, 'package.json'), '{"name":"ws"}');
    writeFileSync(join(workspace, 'turbo.json'), '{"pipeline":{}}');
    writeFileSync(join(workspace, 'AGENTS.md'), '# Agent rules\nFollow project guidance.');
    writeFileSync(join(workspace, 'CLAUDE.md'), '# Claude rules\nUse service boundaries.');
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
        rules: expect.objectContaining({
          present: 2,
          total: 4,
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              id: 'rules-overlap',
              level: 'warning',
            }),
            expect.objectContaining({
              id: 'missing-cline-rules',
              level: 'info',
            }),
          ]),
        }),
      }),
    );
    expect(result.workspaces[0]?.rules?.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agents',
          status: 'present',
          summary: '# Agent rules',
        }),
        expect.objectContaining({
          id: 'claude',
          status: 'present',
          summary: '# Claude rules',
        }),
        expect.objectContaining({
          id: 'cline-rules',
          status: 'missing',
        }),
      ]),
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

  it('pullImage skips the pull when the fallback image is already present', async () => {
    const docker = {
      imagePresent: jest.fn().mockResolvedValue(true),
      pull: jest.fn(),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);
    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(docker.imagePresent).toHaveBeenCalledWith(expect.stringContaining('codex-cli'));
    expect(docker.pull).not.toHaveBeenCalled();
    expect(outcome.status).toBe('already-present');
    expect(outcome.message).toBe('Docker fallback image is already present.');
  });

  it('pullImage reports failure when the initial image inspection errors', async () => {
    const docker = {
      imagePresent: jest.fn().mockRejectedValue(new Error('Docker inspect failed.')),
      pull: jest.fn(),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);

    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(docker.pull).not.toHaveBeenCalled();
    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('Docker image readiness inspection failed.');
  });

  it('pullImage verifies local readiness after a successful pull', async () => {
    const docker = {
      imagePresent: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      pull: jest.fn().mockResolvedValue({ ok: true, message: 'Pulled image.' }),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);
    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(docker.pull).toHaveBeenCalledWith(expect.stringContaining('codex-cli'));
    expect(docker.imagePresent).toHaveBeenCalledTimes(2);
    expect(outcome.status).toBe('pulled');
    expect(outcome.message).toBe('Pulled image.');
  });

  it('pullImage reports failure when a successful pull is not inspectable afterward', async () => {
    const docker = {
      imagePresent: jest.fn().mockResolvedValue(false),
      pull: jest.fn().mockResolvedValue({ ok: true, message: 'Pulled image.' }),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);
    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('Docker image pull finished, but the image is not ready locally.');
  });

  it('pullImage reports failure when post-pull image inspection errors', async () => {
    const docker = {
      imagePresent: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('Docker inspect failed.')),
      pull: jest.fn().mockResolvedValue({ ok: true, message: 'Pulled image.' }),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);

    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('Docker image pull finished, but readiness inspection failed.');
  });

  it('pullImage reports failure via the docker client without throwing', async () => {
    const docker = {
      imagePresent: jest.fn().mockResolvedValue(false),
      pull: jest.fn().mockResolvedValue({ ok: false, message: 'Docker is not available.' }),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);
    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(docker.pull).toHaveBeenCalledWith(expect.stringContaining('codex-cli'));
    expect(outcome.status).toBe('failed');
    expect(outcome.agent).toBe('codex');
    expect(outcome.image).toMatch(/codex-cli/);
  });

  it('pullImage reports failure when the docker client pull itself rejects', async () => {
    const docker = {
      imagePresent: jest.fn().mockResolvedValue(false),
      pull: jest.fn().mockRejectedValue(new Error('docker client crashed')),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);

    const outcome = await serviceWithDocker.pullImage('default', 'codex');

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('Docker image pull failed before completion.');
  });

  it('pullImage rejects when the workspace does not exist', async () => {
    const docker = {
      imagePresent: jest.fn(),
      pull: jest.fn(),
    } as unknown as LoopsDockerClient;
    const serviceWithDocker = new LoopsWorkspaceProfileService(undefined, docker);

    await expect(serviceWithDocker.pullImage('missing-workspace', 'codex')).rejects.toThrow(
      'Workspace not found: missing-workspace',
    );
    expect(docker.imagePresent).not.toHaveBeenCalled();
    expect(docker.pull).not.toHaveBeenCalled();
  });
});
