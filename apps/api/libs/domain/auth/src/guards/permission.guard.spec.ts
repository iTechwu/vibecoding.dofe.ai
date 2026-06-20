import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CommonErrorCode } from '@repo/contracts/errors';
import { PermissionGuard } from './permission.guard';
import { RequireModulePermission, RequireSuperAdmin } from '../decorators/rbac.decorator';
import type { PermissionService } from '../permission.service';

function createLogger() {
  return {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

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
  it('checks module permissions through the SSO-backed permission service', async () => {
    class HandlerHost {
      @RequireModulePermission('vibecoding', 'loops', 'read')
      handler() {
        return undefined;
      }
    }

    const service = {
      isSuperAdmin: jest.fn().mockReturnValue(false),
      checkModulePermission: jest.fn().mockResolvedValue(true),
    } as unknown as PermissionService;
    const guard = new PermissionGuard(new Reflector(), service, createLogger() as never);

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: '264656bc-8a28-4a00-bcd0-32b2fce051f5',
          isAdmin: false,
          url: '/loops/issues',
        }),
      ),
    ).resolves.toBe(true);
    expect(service.checkModulePermission).toHaveBeenCalledWith(
      '264656bc-8a28-4a00-bcd0-32b2fce051f5',
      'vibecoding',
      'loops',
      'read',
      undefined,
    );
  });

  it('denies missing SSO permissions with a generic unauthorized error', async () => {
    class HandlerHost {
      @RequireModulePermission('vibecoding', 'loops', 'operate')
      handler() {
        return undefined;
      }
    }

    const service = {
      isSuperAdmin: jest.fn().mockReturnValue(false),
      checkModulePermission: jest.fn().mockResolvedValue(false),
    } as unknown as PermissionService;
    const guard = new PermissionGuard(new Reflector(), service, createLogger() as never);

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'reader-only',
          isAdmin: false,
          url: '/loops/issues/issue-1/run',
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }));
  });

  it('allows SSO-synced super admins to bypass module permission lookups', async () => {
    class HandlerHost {
      @RequireModulePermission('vibecoding', 'loops', 'admin')
      handler() {
        return undefined;
      }
    }

    const service = {
      isSuperAdmin: jest.fn().mockReturnValue(true),
      checkModulePermission: jest.fn(),
    } as unknown as PermissionService;
    const guard = new PermissionGuard(new Reflector(), service, createLogger() as never);

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'admin-user',
          isAdmin: true,
          url: '/loops/doctor',
        }),
      ),
    ).resolves.toBe(true);
    expect(service.checkModulePermission).not.toHaveBeenCalled();
  });

  it('enforces explicit super admin routes', async () => {
    class HandlerHost {
      @RequireSuperAdmin()
      handler() {
        return undefined;
      }
    }

    const service = {
      isSuperAdmin: jest.fn().mockReturnValue(false),
    } as unknown as PermissionService;
    const guard = new PermissionGuard(new Reflector(), service, createLogger() as never);

    await expect(
      guard.canActivate(
        createContext(HandlerHost.prototype.handler, {
          userId: 'regular-user',
          isAdmin: false,
          url: '/admin',
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }));
  });
});
