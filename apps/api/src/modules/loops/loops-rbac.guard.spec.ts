import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CommonErrorCode } from '@repo/contracts/errors';
import {
  LOOPS_PERMISSION,
  RequireLoopsPermission,
  type LoopsPermission,
} from './loops-rbac.decorator';
import { hasLoopsPermission, LoopsRbacGuard } from './loops-rbac.guard';

function createExecutionContext(
  permission: LoopsPermission,
  userInfo?: { id: string; isAdmin: boolean },
): ExecutionContext {
  class TestController {}
  class HandlerHost {
    @RequireLoopsPermission(permission)
    handler() {
      return undefined;
    }
  }

  const handler = HandlerHost.prototype.handler;
  return {
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ userInfo }),
    }),
  } as unknown as ExecutionContext;
}

describe('LoopsRbacGuard', () => {
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'MODE_USER_ID',
      'NODE_ENV',
      'LOOPS_RBAC_READ_USER_IDS',
      'LOOPS_RBAC_CREATE_USER_IDS',
      'LOOPS_RBAC_OPERATE_USER_IDS',
      'LOOPS_RBAC_ADMIN_USER_IDS',
    ]) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('allows admins to use every Loops permission', () => {
    const guard = new LoopsRbacGuard(new Reflector());

    expect(
      guard.canActivate(
        createExecutionContext(LOOPS_PERMISSION.ADMIN, {
          id: 'admin-user',
          isAdmin: true,
        }),
      ),
    ).toBe(true);
  });

  it('allows non-production MODE_USER_ID as a local development bypass', () => {
    process.env.MODE_USER_ID = 'dev-user';
    process.env.NODE_ENV = 'test';

    expect(hasLoopsPermission({ id: 'dev-user', isAdmin: false }, LOOPS_PERMISSION.OPERATE)).toBe(
      true,
    );
  });

  it('allows explicitly allowlisted users for the requested permission', () => {
    process.env.LOOPS_RBAC_CREATE_USER_IDS = 'creator-1, creator-2';

    expect(hasLoopsPermission({ id: 'creator-2', isAdmin: false }, LOOPS_PERMISSION.CREATE)).toBe(
      true,
    );
  });

  it('denies authenticated users without the required Loops permission with 403', () => {
    const guard = new LoopsRbacGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createExecutionContext(LOOPS_PERMISSION.OPERATE, {
          id: 'reader-only',
          isAdmin: false,
        }),
      ),
    ).toThrow(expect.objectContaining({ errorCode: CommonErrorCode.FeatureHasPermissions }));
  });

  it('rejects missing AuthGuard user context as unauthorized', () => {
    const guard = new LoopsRbacGuard(new Reflector());

    expect(() => guard.canActivate(createExecutionContext(LOOPS_PERMISSION.READ))).toThrow(
      expect.objectContaining({ errorCode: CommonErrorCode.UnAuthorized }),
    );
  });
});
