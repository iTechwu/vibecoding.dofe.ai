import { SsoScopeService } from './sso-scope.service';

describe('SsoScopeService', () => {
  it('creates a personal workspace scope when an authenticated user has no selection', async () => {
    const service = new SsoScopeService();

    await expect(service.resolve({ ssoSubject: 'sso-user-1' })).resolves.toEqual({
      tenantId: 'user:sso-user-1',
      tenantName: 'Personal workspace',
    });
  });

  it('uses the selected workspace without querying SSO membership', async () => {
    const service = new SsoScopeService();

    await expect(
      service.resolve({ ssoSubject: 'sso-user-1', tenantId: ' tenant-selected ' }),
    ).resolves.toEqual({
      tenantId: 'tenant-selected',
      tenantName: 'tenant-selected',
    });
  });
});
