import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiError } from '@dofe/infra-common';
import { CommonErrorCode } from '@repo/contracts/errors';
import { IS_PUBLIC_KEY } from '../auth';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      userId?: string;
      isAdmin?: boolean;
      teamId?: string;
      url?: string;
    }>();

    if (!request.userId) {
      throw apiError(CommonErrorCode.UnAuthorized, 'User not authenticated');
    }

    // Vibecoding uses an authenticated-user access model. Legacy RBAC metadata
    // remains on handlers for contract compatibility, but is not evaluated.
    return true;
  }
}
