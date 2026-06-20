import { RequireModulePermission } from '@app/auth';

export const LOOPS_PERMISSION = {
  READ: 'read',
  CREATE: 'create',
  OPERATE: 'operate',
  ADMIN: 'admin',
} as const;

export type LoopsPermission = (typeof LOOPS_PERMISSION)[keyof typeof LOOPS_PERMISSION];

export const RequireLoopsPermission = (permission: LoopsPermission) =>
  RequireModulePermission('vibecoding', 'loops', permission);
