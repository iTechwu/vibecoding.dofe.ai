import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest, AuthUserInfo } from './types/auth.interface';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator(
  (property: keyof AuthUserInfo | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const userInfo = request.userInfo;
    if (!userInfo) return null;
    return property ? userInfo[property] : userInfo;
  },
);

export interface AuthOptions {
  enableRbac?: boolean;
  enableModulePermission?: boolean;
}

export function Auth(
  authType: 'api' | 'admin' = 'api',
  guardType: 'sse' | 'api' = 'api',
  options: AuthOptions | boolean = {},
) {
  const normalizedOptions: AuthOptions =
    typeof options === 'boolean' ? { enableRbac: options } : options;

  const { enableRbac = true, enableModulePermission = true } = normalizedOptions;

  return applyDecorators(
    SetMetadata('auths', [authType, guardType]),
    SetMetadata('enableRbac', enableRbac),
    SetMetadata('enableModulePermission', enableModulePermission),
    UseGuards(AuthGuard),
    ApiBearerAuth() as ClassDecorator & MethodDecorator,
  );
}
