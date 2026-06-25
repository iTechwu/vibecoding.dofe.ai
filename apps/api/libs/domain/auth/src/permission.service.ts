import { Inject, Injectable } from '@nestjs/common';
import { SsoClientService } from '@dofe/sso-nestjs';
import { formatPermission, parsePermission } from '@dofe/sso-node';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { ModulePermissionMeta } from './decorators/rbac.decorator';

@Injectable()
export class PermissionService {
  constructor(
    private readonly ssoClient: SsoClientService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async checkModulePermission(
    userId: string,
    module: string,
    resource: string,
    action: string,
    teamId?: string,
  ): Promise<boolean> {
    const permission = formatPermission({ module, resource, action });

    try {
      return await this.ssoClient.checkPermission(userId, permission, teamId);
    } catch (error) {
      this.logger.error('[PermissionService] SSO permission check failed', {
        userId,
        permission,
        teamId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async checkAnyModulePermission(
    userId: string,
    permissions: ModulePermissionMeta[],
    teamId?: string,
  ): Promise<boolean> {
    for (const permission of permissions) {
      const granted = await this.checkModulePermission(
        userId,
        permission.module,
        permission.resource,
        permission.action,
        teamId,
      );
      if (granted) return true;
    }
    return false;
  }

  async checkAllModulePermissions(
    userId: string,
    permissions: ModulePermissionMeta[],
    teamId?: string,
  ): Promise<boolean> {
    for (const permission of permissions) {
      const granted = await this.checkModulePermission(
        userId,
        permission.module,
        permission.resource,
        permission.action,
        teamId,
      );
      if (!granted) return false;
    }
    return true;
  }

  async getUserPermissions(
    userId: string,
    teamId?: string,
  ): Promise<{ resource: string; action: string }[]> {
    try {
      const permissions = await this.ssoClient.getUserPermissions(userId, teamId);

      return permissions.permissions.map((permission) => {
        const parsed = parsePermission(permission);
        return { resource: parsed.resource, action: parsed.action };
      });
    } catch (error) {
      this.logger.error('[PermissionService] Get user permissions failed', {
        userId,
        teamId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async getUserPermissionSnapshot(
    userId: string,
    teamId?: string,
  ): Promise<{ permissions: string[]; roles: string[] }> {
    try {
      return await this.ssoClient.getUserPermissions(userId, teamId);
    } catch (error) {
      this.logger.error('[PermissionService] Get user permission snapshot failed', {
        userId,
        teamId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { permissions: [], roles: [] };
    }
  }

  isSuperAdmin(isAdmin?: boolean): boolean {
    return isAdmin === true;
  }
}
