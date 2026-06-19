'use client';

/**
 * Notification API Hooks (Scaffold Reference)
 *
 * 此文件展示了基于 ts-rest 契约的 API Hook 实现模式。
 * 实际项目使用步骤：
 * 1. 在 @repo/contracts 中定义 notificationContract
 * 2. 在 client.ts 中导出 notificationClient
 * 3. 取消下方示例代码的注释并替换占位符
 */

// ============================================================================
// Query Keys (示例)
// ============================================================================

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: Record<string, unknown>) =>
    [...notificationKeys.all, 'list', params] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
};
