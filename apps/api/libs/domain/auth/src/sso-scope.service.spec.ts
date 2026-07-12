import { SsoScopeService } from './sso-scope.service';
import { CommonErrorCode } from '@repo/contracts/errors';

describe('SsoScopeService', () => {
  function buildService(tenants: Array<Record<string, unknown>>) {
    const ssoClient = {
      client: {
        users: {
          getTenants: jest.fn().mockResolvedValue(tenants),
          getTeams: jest.fn().mockResolvedValue([]),
        },
      },
    };
    return { service: new SsoScopeService(ssoClient as never), ssoClient };
  }

  it('resolves the tenant ID and display name from SSO instead of the client candidate', async () => {
    const { service, ssoClient } = buildService([
      {
        tenantId: 'tenant-sso-1',
        tenantName: 'SSO authoritative name',
        tenantDisplayName: 'SSO display name',
      },
    ]);

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: 'tenant-sso-1' }),
    ).resolves.toEqual({
      tenantId: 'tenant-sso-1',
      tenantName: 'SSO display name',
    });
    expect(ssoClient.client.users.getTenants).toHaveBeenCalledWith('sso-user-1');
  });

  it('rejects a tenant ID that is not in the authenticated SSO user scope', async () => {
    const { service } = buildService([{ tenantId: 'tenant-sso-1', tenantName: 'Allowed' }]);

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: 'tenant-other' }),
    ).rejects.toThrow(expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }));
  });

  it('requires a tenant candidate instead of assigning a local default tenant', async () => {
    const { service } = buildService([]);

    await expect(service.resolve({ ssoSubject: 'sso-user-1' })).rejects.toThrow(
      expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }),
    );
  });
});
