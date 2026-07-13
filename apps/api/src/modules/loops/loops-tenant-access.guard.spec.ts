import type { ExecutionContext } from '@nestjs/common';
import { LoopsTenantAccessGuard } from './loops-tenant-access.guard';
import type { SsoScopeService } from '@app/auth/sso-scope.service';

describe('LoopsTenantAccessGuard', () => {
  it('grants Loops access to an authenticated SSO tenant member', async () => {
    const request = {
      ssoSub: 'sso-user-1',
      headers: { 'x-current-tenant': 'tenant-1' },
    };
    const scopeService = {
      resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1', tenantName: 'Tenant One' }),
    } as unknown as SsoScopeService;
    const guard = new LoopsTenantAccessGuard(scopeService);
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(scopeService.resolve).toHaveBeenCalledWith({
      ssoSubject: 'sso-user-1',
      tenantId: 'tenant-1',
    });
    expect(request).toMatchObject({ tenantId: 'tenant-1' });
  });
});
