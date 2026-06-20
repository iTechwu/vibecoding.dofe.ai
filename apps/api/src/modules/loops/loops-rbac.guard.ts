import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiError } from '@dofe/infra-common';
import { CommonErrorCode } from '@repo/contracts/errors';
import type { AuthenticatedRequest, AuthUserInfo } from '@app/auth';
import {
  LOOPS_PERMISSION,
  LOOPS_PERMISSION_KEY,
  type LoopsPermission,
} from './loops-rbac.decorator';

const PERMISSION_ALLOWLIST_ENV: Record<LoopsPermission, string> = {
  [LOOPS_PERMISSION.READ]: 'LOOPS_RBAC_READ_USER_IDS',
  [LOOPS_PERMISSION.CREATE]: 'LOOPS_RBAC_CREATE_USER_IDS',
  [LOOPS_PERMISSION.OPERATE]: 'LOOPS_RBAC_OPERATE_USER_IDS',
  [LOOPS_PERMISSION.ADMIN]: 'LOOPS_RBAC_ADMIN_USER_IDS',
};

function parseUserIdAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function hasLoopsPermission(
  user: Pick<AuthUserInfo, 'id' | 'isAdmin'>,
  permission: LoopsPermission,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (user.isAdmin) {
    return true;
  }

  if (env.MODE_USER_ID && env.NODE_ENV !== 'prod' && user.id === env.MODE_USER_ID) {
    return true;
  }

  const adminAllowlist = parseUserIdAllowlist(env.LOOPS_RBAC_ADMIN_USER_IDS);
  if (adminAllowlist.has(user.id)) {
    return true;
  }

  const allowlist = parseUserIdAllowlist(env[PERMISSION_ALLOWLIST_ENV[permission]]);
  return allowlist.has(user.id);
}

@Injectable()
export class LoopsRbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<LoopsPermission>(LOOPS_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.userInfo?.id) {
      throw apiError(CommonErrorCode.UnAuthorized);
    }

    if (hasLoopsPermission(request.userInfo, permission)) {
      return true;
    }

    throw apiError(CommonErrorCode.FeatureHasPermissions, {
      permission,
      userId: request.userInfo.id,
    });
  }
}
