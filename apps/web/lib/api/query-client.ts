'use client';

/**
 * Query Client 单例
 * 用于在 hooks 外部访问 queryClient（如预加载）
 *
 * 统一导出 getQueryClient，与 providers/query-provider.tsx 共享同一实例。
 */

export { getQueryClient } from '@/providers/query-provider';
