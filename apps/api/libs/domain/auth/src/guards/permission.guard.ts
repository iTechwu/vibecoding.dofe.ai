import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiError } from '@dofe/infra-common';
import { CommonErrorCode } from '@repo/contracts/errors';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { IS_PUBLIC_KEY } from '../auth';
import { MODULE_PERMISSION_KEY, type ModulePermissionMeta } from '../decorators/rbac.decorator';
import { PermissionService } from '../permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

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

    const enableModulePermission = this.reflector.getAllAndOverride<boolean>(
      'enableModulePermission',
      [context.getHandler(), context.getClass()],
    );
    if (enableModulePermission === false) return true;

    const requireSuperAdmin = this.reflector.getAllAndOverride<boolean>('superAdmin', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireSuperAdmin) {
      if (!this.permissionService.isSuperAdmin(request.isAdmin)) {
        this.logger.warn('[PermissionGuard] Super admin check failed', {
          userId: request.userId,
          endpoint: request.url,
        });
        throw apiError(CommonErrorCode.UnAuthorized, 'Requires super admin');
      }
      return true;
    }

    const allPermissions = this.reflector.get<ModulePermissionMeta[]>(
      'allModulePermissions',
      context.getHandler(),
    );
    if (allPermissions?.length) {
      const granted = await this.permissionService.checkAllModulePermissions(
        request.userId,
        allPermissions,
        request.teamId,
      );
      if (!granted) {
        this.logger.warn('[PermissionGuard] All-module-permissions check failed', {
          userId: request.userId,
          endpoint: request.url,
          required: allPermissions,
        });
        throw apiError(CommonErrorCode.UnAuthorized, 'Insufficient permissions');
      }
      return true;
    }

    const oneOfPermissions = this.reflector.get<ModulePermissionMeta[]>(
      'anyModulePermission',
      context.getHandler(),
    );
    if (oneOfPermissions?.length) {
      const granted = await this.permissionService.checkAnyModulePermission(
        request.userId,
        oneOfPermissions,
        request.teamId,
      );
      if (!granted) {
        this.logger.warn('[PermissionGuard] Any-module-permission check failed', {
          userId: request.userId,
          endpoint: request.url,
          required: oneOfPermissions,
        });
        throw apiError(CommonErrorCode.UnAuthorized, 'Insufficient permissions');
      }
      return true;
    }

    const modulePermission = this.reflector.get<ModulePermissionMeta>(
      MODULE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!modulePermission) return true;

    if (this.permissionService.isSuperAdmin(request.isAdmin)) {
      return true;
    }

    const granted = await this.permissionService.checkModulePermission(
      request.userId,
      modulePermission.module,
      modulePermission.resource,
      modulePermission.action,
      request.teamId,
    );
    if (!granted) {
      this.logger.warn('[PermissionGuard] Module permission check failed', {
        userId: request.userId,
        endpoint: request.url,
        required: modulePermission,
      });
      throw apiError(CommonErrorCode.UnAuthorized, 'Insufficient permissions');
    }

    return true;
  }
}
