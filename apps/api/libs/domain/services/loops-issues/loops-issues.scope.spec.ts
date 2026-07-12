import { NotFoundException } from '@nestjs/common';
import { LoopsIssuesService } from './loops-issues.service';

/**
 * Scope-aware read behaviour activated by Cycle 8
 * (docs/0712/tenant-team-sso-unique-source): the service layer turns a tenant
 * mismatch / NULL-scope row into a 404 so the existence of another tenant's
 * issue is never leaked, and never falls back to the file store for a scoped read.
 */
describe('LoopsIssuesService — scope-aware read', () => {
  function buildService(persistence: Record<string, jest.Mock>) {
    const store = {};
    return new LoopsIssuesService(store as never, persistence as never, undefined, undefined);
  }

  it('getIssue throws NotFoundException when the scoped tenant does not own the issue', async () => {
    const persistence = { readDetailScoped: jest.fn().mockResolvedValue(null) };
    const service = buildService(persistence);

    await expect(
      service.getIssue('issue-1', (d) => d, { tenantId: 'tenant-a' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(persistence.readDetailScoped).toHaveBeenCalledWith('issue-1', { tenantId: 'tenant-a' });
  });

  it('getIssue returns the enriched detail when the scope matches', async () => {
    const persistence = {
      readDetailScoped: jest.fn().mockResolvedValue({ issue: { id: 'issue-1' } }),
    };
    const service = buildService(persistence);

    const detail = await service.getIssue(
      'issue-1',
      (d: { issue: { id: string } }) => ({ ...d, enriched: true }),
      { tenantId: 'tenant-a' },
    );

    expect(detail).toMatchObject({ issue: { id: 'issue-1' }, enriched: true });
  });

  it('getIssue refuses to trust the file store when scoped without persistence (standalone)', async () => {
    const service = new LoopsIssuesService({} as never, undefined, undefined, undefined);

    await expect(
      service.getIssue('issue-1', (d) => d, { tenantId: 'tenant-a' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('list pushes the verified scope into persistence.list', async () => {
    const persistence = {
      list: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, limit: 20 }),
    };
    const service = buildService(persistence);

    await service.list({} as never, async (r) => r, { tenantId: 'tenant-a' });

    expect(persistence.list).toHaveBeenCalledWith({}, { tenantId: 'tenant-a' });
  });
});
