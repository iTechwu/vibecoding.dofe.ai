import { SetMetadata } from '@nestjs/common';

export const LOOPS_PERMISSION_KEY = 'loopsPermission';

export const LOOPS_PERMISSION = {
  READ: 'loops:read',
  CREATE: 'loops:create',
  OPERATE: 'loops:operate',
  ADMIN: 'loops:admin',
} as const;

export type LoopsPermission = (typeof LOOPS_PERMISSION)[keyof typeof LOOPS_PERMISSION];

export const RequireLoopsPermission = (permission: LoopsPermission) =>
  SetMetadata(LOOPS_PERMISSION_KEY, permission);
