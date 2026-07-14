import { SetMetadata } from '@nestjs/common';

// Legacy metadata retained for API compatibility. PermissionGuard grants every
// authenticated Vibecoding user access regardless of this metadata.
export const RequireSuperAdmin = () => SetMetadata('superAdmin', true);

/**
 * Legacy module-permission metadata retained for API compatibility.
 */
export interface ModulePermissionMeta {
  module: string;
  resource: string;
  action: string;
}

// 模块权限检查装饰器的元数据 key
export const MODULE_PERMISSION_KEY = 'modulePermission';

/**
 * 模块权限检查装饰器
 * 用于细粒度的模块级权限控制
 *
 * @example
 * @RequireModulePermission('recruitment', 'job', 'create')
 * async createJob() { ... }
 */
export const RequireModulePermission = (module: string, resource: string, action: string) =>
  SetMetadata(MODULE_PERMISSION_KEY, {
    module,
    resource,
    action,
  } as ModulePermissionMeta);

/**
 * 多个模块权限检查装饰器（满足任一条件即可）
 *
 * @example
 * ```typescript
 * @RequireAnyModulePermission([
 *   { module: 'recruitment', resource: 'job', action: 'read' },
 *   { module: 'recruitment', resource: 'candidate', action: 'read' },
 * ])
 * async viewRecruitmentData() { ... }
 * ```
 */
export const RequireAnyModulePermission = (permissions: ModulePermissionMeta[]) =>
  SetMetadata('anyModulePermission', permissions);

/**
 * 多个模块权限检查装饰器（必须满足所有条件）
 *
 * @example
 * ```typescript
 * @RequireAllModulePermissions([
 *   { module: 'recruitment', resource: 'job', action: 'read' },
 *   { module: 'recruitment', resource: 'candidate', action: 'create' },
 * ])
 * async createCandidateForJob() { ... }
 * ```
 */
export const RequireAllModulePermissions = (permissions: ModulePermissionMeta[]) =>
  SetMetadata('allModulePermissions', permissions);
