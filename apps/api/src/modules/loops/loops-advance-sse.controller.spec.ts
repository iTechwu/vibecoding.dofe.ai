import { firstValueFrom, of } from 'rxjs';

const mockAuth = jest.fn(() => () => undefined);

jest.mock('@app/auth', () => ({
  Auth: mockAuth,
  RequireSuperAdmin: () => () => undefined,
  RequireModulePermission: () => () => undefined,
  SsoScopeService: class {},
}));

import { LoopsController } from './loops.controller';

describe('LoopsController advanceEvents', () => {
  it('uses the SSE auth mode so EventSource can supply its access token', () => {
    expect(mockAuth).toHaveBeenCalledWith('api', 'sse');
  });

  it('authorizes the issue before streaming the persisted advance status', async () => {
    const assertIssueScope = jest.fn();
    const status = {
      jobId: 'advance:issue-1',
      issueId: 'issue-1',
      status: 'active' as const,
      attempt: 1,
      updatedAt: '2026-07-13T00:00:00.000Z',
    };
    const controller = new LoopsController(
      { assertIssueScope } as never,
      {} as never,
      { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } as never,
      {} as never,
      {} as never,
      { warn: jest.fn() } as never,
      { watch: jest.fn().mockReturnValue(of(status)) } as never,
      undefined,
    );

    const stream = await controller['advanceEvents'](
      { ssoSub: 'sso-user-1', headers: {} } as never,
      'issue-1',
    );

    await expect(firstValueFrom(stream)).resolves.toEqual({ type: 'advance-status', data: status });
    expect(assertIssueScope).toHaveBeenCalledWith('issue-1', { tenantId: 'tenant-1' });
  });
});
