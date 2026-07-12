import { SsoScopeService } from './sso-scope.service';
import { CommonErrorCode } from '@repo/contracts/errors';

describe('SsoScopeService', () => {
  function buildService(
    opts: {
      tenants?: Array<Record<string, unknown>>;
      preference?: Record<string, unknown> | null;
      preferenceRejects?: boolean;
    } = {},
  ) {
    const getTenants = jest.fn().mockResolvedValue(opts.tenants ?? []);
    const getTenantPreference = opts.preferenceRejects
      ? jest.fn().mockRejectedValue(new Error('preference unavailable'))
      : jest.fn().mockResolvedValue(opts.preference ?? null);
    const ssoClient = {
      client: {
        users: {
          getTenants,
          getTeams: jest.fn().mockResolvedValue([]),
          getTenantPreference,
        },
      },
    };
    return { service: new SsoScopeService(ssoClient as never), ssoClient };
  }

  it('prefers the SSO-maintained current tenant (preference.lastTenantId) over the client candidate', async () => {
    const { service } = buildService({
      tenants: [
        { tenantId: 'tenant-pref', tenantName: 'Preferred', tenantDisplayName: 'Preferred' },
        { tenantId: 'tenant-cand', tenantName: 'Candidate' },
      ],
      preference: { userId: 'sso-user-1', lastTenantId: 'tenant-pref', updatedAt: '2026-07-12' },
    });

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: 'tenant-cand' }),
    ).resolves.toEqual({ tenantId: 'tenant-pref', tenantName: 'Preferred' });
  });

  it('falls back to the client candidate when SSO has no recorded preference', async () => {
    const { service } = buildService({
      tenants: [
        {
          tenantId: 'tenant-cand',
          tenantName: 'Candidate',
          tenantDisplayName: 'Candidate Display',
        },
      ],
      preference: { userId: 'sso-user-1', lastTenantId: null, updatedAt: '2026-07-12' },
    });

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: 'tenant-cand' }),
    ).resolves.toEqual({ tenantId: 'tenant-cand', tenantName: 'Candidate Display' });
  });

  it('falls back to the client candidate when getTenantPreference is unavailable', async () => {
    const { service } = buildService({
      tenants: [{ tenantId: 'tenant-cand', tenantName: 'Candidate' }],
      preferenceRejects: true,
    });

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: 'tenant-cand' }),
    ).resolves.toEqual({ tenantId: 'tenant-cand', tenantName: 'Candidate' });
  });

  it('rejects when the SSO-preferred tenant is not in the user membership list', async () => {
    const { service } = buildService({
      tenants: [{ tenantId: 'tenant-other', tenantName: 'Other' }],
      preference: { userId: 'sso-user-1', lastTenantId: 'tenant-pref', updatedAt: '2026-07-12' },
    });

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: 'tenant-other' }),
    ).rejects.toThrow(expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }));
  });

  it('rejects when neither preference nor a client candidate provides a tenant', async () => {
    const { service } = buildService({
      tenants: [{ tenantId: 'tenant-1', tenantName: 'T' }],
      preference: { userId: 'sso-user-1', lastTenantId: null, updatedAt: '2026-07-12' },
    });

    await expect(service.resolve({ ssoSubject: 'sso-user-1' })).rejects.toThrow(
      expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }),
    );
  });
});
