import { LoopsScopeBackfillService } from './loops-scope-backfill.service';

describe('LoopsScopeBackfillService', () => {
  function buildService() {
    const persistence = {
      listUnscopedIssues: jest.fn(),
      assignTenantIdIfUnscoped: jest.fn().mockResolvedValue(true),
    };
    const ssoScope = { resolve: jest.fn() };
    return {
      service: new LoopsScopeBackfillService(persistence as never, ssoScope as never),
      persistence,
      ssoScope,
    };
  }

  it('maps a verified SSO submitter in dry-run mode without writing', async () => {
    const { service, persistence, ssoScope } = buildService();
    persistence.listUnscopedIssues.mockResolvedValue([
      { id: 'issue-1', submitterId: 'sso-user-1', submitterProvider: 'dofe-sso' },
    ]);
    ssoScope.resolve.mockResolvedValue({ tenantId: 'tenant-1', tenantName: 'Tenant 1' });

    await expect(service.run()).resolves.toMatchObject({
      dryRun: true,
      examined: 1,
      mapped: [{ issueId: 'issue-1', tenantId: 'tenant-1' }],
      updated: 0,
    });
    expect(persistence.assignTenantIdIfUnscoped).not.toHaveBeenCalled();
    expect(ssoScope.resolve).toHaveBeenCalledWith({ ssoSubject: 'sso-user-1' });
  });

  it('writes only a verified SSO mapping when dryRun is disabled', async () => {
    const { service, persistence, ssoScope } = buildService();
    persistence.listUnscopedIssues.mockResolvedValue([
      { id: 'issue-1', submitterId: 'sso-user-1', submitterProvider: 'dofe-sso' },
    ]);
    ssoScope.resolve.mockResolvedValue({ tenantId: 'tenant-1', tenantName: 'Tenant 1' });

    await expect(service.run({ dryRun: false })).resolves.toMatchObject({
      updated: 1,
      pending: [],
    });
    expect(persistence.assignTenantIdIfUnscoped).toHaveBeenCalledWith('issue-1', 'tenant-1');
  });

  it('leaves non-SSO submitters and unverified SSO scope pending', async () => {
    const { service, persistence, ssoScope } = buildService();
    persistence.listUnscopedIssues.mockResolvedValue([
      { id: 'issue-dev', submitterId: 'dev-1', submitterProvider: 'dev' },
      { id: 'issue-sso', submitterId: 'sso-user-2', submitterProvider: 'dofe-sso' },
    ]);
    ssoScope.resolve.mockRejectedValue(new Error('no preference'));

    await expect(service.run({ dryRun: false })).resolves.toMatchObject({
      mapped: [],
      pending: [
        { issueId: 'issue-dev', reason: 'non-sso-submitter' },
        { issueId: 'issue-sso', reason: 'unverified-sso-scope' },
      ],
      updated: 0,
    });
    expect(persistence.assignTenantIdIfUnscoped).not.toHaveBeenCalled();
  });

  it('does not count a concurrently scoped row as updated', async () => {
    const { service, persistence, ssoScope } = buildService();
    persistence.listUnscopedIssues.mockResolvedValue([
      { id: 'issue-1', submitterId: 'sso-user-1', submitterProvider: 'dofe-sso' },
    ]);
    ssoScope.resolve.mockResolvedValue({ tenantId: 'tenant-1', tenantName: 'Tenant 1' });
    persistence.assignTenantIdIfUnscoped.mockResolvedValue(false);

    await expect(service.run({ dryRun: false })).resolves.toMatchObject({
      mapped: [],
      pending: [{ issueId: 'issue-1', reason: 'concurrent-scope-assignment' }],
      updated: 0,
    });
  });
});
