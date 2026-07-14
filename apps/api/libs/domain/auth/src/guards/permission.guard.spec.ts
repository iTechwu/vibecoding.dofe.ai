import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CommonErrorCode } from '@repo/contracts/errors';
import { PermissionGuard } from './permission.guard';
import { RequireModulePermission, RequireSuperAdmin } from '../decorators/rbac.decorator';

function createContext(
  handler: () => void,
  request: { userId?: string; isAdmin?: boolean; teamId?: string; url?: string },
): ExecutionContext {
  class TestController {}

  return {
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('allows every authenticated user through module and super-admin route metadata', async () => {
    class HandlerHost {
      @RequireSuperAdmin()
      @RequireModulePermission('vibecoding', 'loops', 'admin')
      handler() {
        return undefined;
      }
    }

    const guard = new PermissionGuard(new Reflector());

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'authenticated-user',
          isAdmin: false,
          url: '/loops/doctor',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows an authenticated user through module permission metadata', async () => {
    class HandlerHost {
      @RequireModulePermission('vibecoding', 'loops', 'read')
      handler() {
        return undefined;
      }
    }

    const guard = new PermissionGuard(new Reflector());

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: '264656bc-8a28-4a00-bcd0-32b2fce051f5',
          isAdmin: false,
          url: '/loops/issues',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows an authenticated user without an SSO module permission', async () => {
    class HandlerHost {
      @RequireModulePermission('vibecoding', 'loops', 'operate')
      handler() {
        return undefined;
      }
    }

    const guard = new PermissionGuard(new Reflector());

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'reader-only',
          isAdmin: false,
          url: '/loops/issues/issue-1/run',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows SSO-synced super admins', async () => {
    class HandlerHost {
      @RequireModulePermission('vibecoding', 'loops', 'admin')
      handler() {
        return undefined;
      }
    }

    const guard = new PermissionGuard(new Reflector());

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'admin-user',
          isAdmin: true,
          url: '/loops/doctor',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows a regular authenticated user through legacy super-admin metadata', async () => {
    class HandlerHost {
      @RequireSuperAdmin()
      handler() {
        return undefined;
      }
    }

    const guard = new PermissionGuard(new Reflector());

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'regular-user',
          isAdmin: false,
          url: '/admin',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('still rejects an unauthenticated request', async () => {
    const guard = new PermissionGuard(new Reflector());

    await expect(
      guard.canActivate(createContext(() => undefined, { url: '/loops' })),
    ).rejects.toThrow(expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }));
  });
});
