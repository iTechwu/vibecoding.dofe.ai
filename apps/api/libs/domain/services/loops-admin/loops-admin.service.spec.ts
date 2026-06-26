import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LoopsFileStoreService } from '@app/services/loops-store';
import { LoopsAdminService } from './loops-admin.service';

describe('LoopsAdminService', () => {
  let workspace: string;
  let previousWorkspaceRoot: string | undefined;
  let service: LoopsAdminService;

  beforeEach(() => {
    previousWorkspaceRoot = process.env.LOOPS_WORKSPACE_ROOT;
    workspace = mkdtempSync(join(tmpdir(), 'loops-admin-'));
    process.env.LOOPS_WORKSPACE_ROOT = workspace;
    service = new LoopsAdminService(new LoopsFileStoreService());
  });

  afterEach(() => {
    if (previousWorkspaceRoot === undefined) delete process.env.LOOPS_WORKSPACE_ROOT;
    else process.env.LOOPS_WORKSPACE_ROOT = previousWorkspaceRoot;
    rmSync(workspace, { recursive: true, force: true });
  });

  it('registers, lists, and health-checks tools through the store', async () => {
    const tool = await service.registerTool({
      name: 'Repository Tools MCP',
      kind: 'mcp',
      category: 'repo',
      description: 'Repository-scoped MCP tool runner',
      authKind: 'mcp',
      permissions: ['repo:read'],
      compatibility: {
        codex: true,
        claudeCode: true,
        thirdParty: 'compatible',
      },
      deterministicBoundary: 'target-repo',
    });

    expect(tool.id).toMatch(/^tool-\d+$/);
    expect(tool.status).toBe('active');

    const listed = await service.listTools({ page: 1, limit: 10 });
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.list.map((item) => item.id)).toContain(tool.id);

    const health = await service.toolHealthCheck(tool.id);
    expect(health.ok).toBe(true);
    expect(health.message).toContain('active and operational');

    const persisted = await service.getTool(tool.id);
    expect(persisted.health.lastCheckedAt).toBe(health.checkedAt);
  });

  it('seeds default blueprints when the blueprint store is empty', async () => {
    const result = await service.listBlueprints({ page: 1, limit: 20 });

    expect(result.total).toBeGreaterThanOrEqual(8);
    expect(result.list.map((blueprint) => blueprint.id)).toEqual(
      expect.arrayContaining(['bp-bugfix', 'bp-feature', 'bp-security']),
    );
    expect(await service.getBlueprint('bp-bugfix')).toEqual(
      expect.objectContaining({
        kind: 'bugfix',
        active: true,
      }),
    );
  });

  it('delegates archive control operations to a narrow archive port', async () => {
    const archivePort = {
      archiveTenant: jest.fn().mockResolvedValue({
        archiveId: 'archive-1',
        tenantId: 'tenant-1',
        fileCount: 2,
        totalSizeBytes: 128,
        storageKey: 'loops/archives/tenant-1/archive-1.json',
        downloadUrl: 'https://download.local/archive-1',
        archivedAt: '2026-06-26T00:00:00.000Z',
      }),
      listArchives: jest.fn().mockResolvedValue([
        {
          archiveId: 'archive-1',
          tenantId: 'tenant-1',
          storageKey: 'loops/archives/tenant-1/archive-1.json',
          fileCount: 2,
          totalSizeBytes: 128,
          archivedAt: '2026-06-26T00:00:00.000Z',
        },
      ]),
      refreshDownloadUrl: jest.fn().mockResolvedValue('https://download.local/archive-1-new'),
    };

    await expect(
      service.archiveTenant(
        { tenantId: 'tenant-1', includeClosed: true, period: '30d' },
        archivePort,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        archiveId: 'archive-1',
        tenantId: 'tenant-1',
        fileCount: 2,
      }),
    );
    expect(archivePort.archiveTenant).toHaveBeenCalledWith('tenant-1', {
      includeClosed: true,
      period: '30d',
    });

    await expect(service.listArchives('tenant-1', archivePort)).resolves.toEqual({
      archives: [expect.objectContaining({ archiveId: 'archive-1' })],
    });

    await expect(service.refreshArchiveUrl('tenant-1', 'archive-1', archivePort)).resolves.toEqual({
      archiveId: 'archive-1',
      downloadUrl: 'https://download.local/archive-1-new',
      message: 'Download URL refreshed',
    });
  });

  it('keeps archive fallback behavior when archive port is not configured', async () => {
    await expect(service.listArchives('tenant-1')).resolves.toEqual({ archives: [] });
    await expect(service.archiveTenant({ tenantId: 'tenant-1' })).rejects.toThrow(
      'Cross-tenant archive service not configured',
    );
    await expect(service.refreshArchiveUrl('tenant-1', 'archive-1')).rejects.toThrow(
      'Cross-tenant archive service not configured',
    );
  });
});
