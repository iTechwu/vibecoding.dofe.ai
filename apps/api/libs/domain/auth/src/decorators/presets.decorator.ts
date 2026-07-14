import { applyDecorators } from '@nestjs/common';
import { Auth } from '../auth';
import { RequireSuperAdmin } from './rbac.decorator';
/**
 * Authenticated-user preset retained for legacy handlers named as admin routes.
 *
 * @example
 * @AdminAuth()
 * async systemSettings() {}
 */
export function AdminAuth() {
  return applyDecorators(Auth('api', 'api'), RequireSuperAdmin());
}
/**
 * 纯认证装饰器（无团队上下文，无权限检查）
 * 适用于用户个人信息相关接口
 *
 * @example
 * @SimpleAuth()
 * async getUserProfile() {}
 */
export function SimpleAuth() {
  return Auth('api', 'api', {
    enableModulePermission: false,
    enableRbac: false,
  });
}

/**
 * SSE 认证装饰器（无团队上下文，无权限检查）
 * 适用于 Server-Sent Events 端点
 *
 * 注意：SSE 端点因为 EventSource 不支持自定义 headers，
 * 所以需要从 query 参数获取 access_token
 *
 * @example
 * @SseAuth()
 * @Sse('message/unread')
 * async getUnreadMessageCountStream() {}
 */
export function SseAuth() {
  return Auth('api', 'sse', {
    enableModulePermission: false,
    enableRbac: false,
  });
}
