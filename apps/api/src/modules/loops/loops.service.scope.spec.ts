import { NotFoundException } from '@nestjs/common';
import { LoopsService } from './loops.service';

/**
 * Ownership gate shared by every issueId-scoped mutation/read (Cycle 9,
 * docs/0712/tenant-team-sso-unique-source). The gate must:
 *  - no-op when no scope is supplied (CLI/internal/system paths unaffected);
 *  - turn a tenant mismatch / NULL-scope row into a 404 so cross-tenant issue
 *    existence is never leaked;
 *  - never trust the file store when scoped without the DB (standalone).
 */
describe('LoopsService.assertIssueScope — issueId ownership gate', () => {
  function buildService(persistence: { readDetailScoped: jest.Mock } | undefined) {
    // assertIssueScope only touches `this.persistence`, so we bypass the heavy
    // constructor and wire just that collaborator.
    const service = Object.create(LoopsService.prototype) as LoopsService;
    Object.assign(service, { persistence });
    return service;
  }

  it('no-ops when no scope is supplied (CLI/internal paths unaffected)', async () => {
    const service = buildService({ readDetailScoped: jest.fn() });
    await expect(service.assertIssueScope('issue-1')).resolves.toBeUndefined();
  });

  it('throws NotFoundException when the tenant does not own the issue', async () => {
    const readDetailScoped = jest.fn().mockResolvedValue(null);
    const service = buildService({ readDetailScoped });

    await expect(
      service.assertIssueScope('issue-1', { tenantId: 'tenant-a' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(readDetailScoped).toHaveBeenCalledWith('issue-1', { tenantId: 'tenant-a' });
  });

  it('passes through when the scope matches the issue owner', async () => {
    const readDetailScoped = jest.fn().mockResolvedValue({ issue: { id: 'issue-1' } });
    const service = buildService({ readDetailScoped });

    await expect(
      service.assertIssueScope('issue-1', { tenantId: 'tenant-a' }),
    ).resolves.toBeUndefined();
  });

  it('refuses when scoped but no persistence is wired (standalone cannot prove ownership)', async () => {
    const service = buildService(undefined);

    await expect(
      service.assertIssueScope('issue-1', { tenantId: 'tenant-a' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
