'use client';

/**
 * 数据预加载工具
 * 用于在用户可能需要数据之前预先加载，提升用户体验
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname } from '@/i18n/navigation';
import { getQueryClient } from './query-client';
import { cacheTime } from './cache-config';
import { logger } from '@/lib/logger';

// ============================================================================
// 单项预加载函数（示例）
// ============================================================================

/**
 * 预加载用户信息
 * 在应用初始化或登录后调用
 */
export async function prefetchUserInfo() {
  // Implement based on your API contracts
  // Example:
  // return queryClient.prefetchQuery({
  //   queryKey: ['user', 'info'],
  //   queryFn: async () => {
  //     return userClient.getInfo({});
  //   },
  //   staleTime: cacheTime.short,
  // });
}

/**
 * 预加载仪表盘数据
 * 在登录成功后或应用初始化时调用
 */
export async function prefetchDashboardData() {
  await Promise.all([
    // prefetchUserInfo(),
    // Add other prefetch functions as needed
  ]);
}

// ============================================================================
// 预加载 Hooks
// ============================================================================

/**
 * 获取预加载函数的 Hook
 * 返回可以在事件（如 hover）中调用的预加载函数
 */
export function usePrefetch() {
  const createHoverHandler = useCallback(
    (prefetchFn: () => Promise<unknown>) => {
      let prefetched = false;
      return () => {
        if (!prefetched) {
          prefetched = true;
          prefetchFn();
        }
      };
    },
    [],
  );

  return {
    createHoverHandler,
    prefetchUserInfo,
    prefetchDashboardData,
  };
}

/**
 * 导航项预加载映射
 * 根据路由路径返回对应的预加载函数
 */
export function useNavPrefetch() {
  const { createHoverHandler } = usePrefetch();

  const navPrefetchMap = useMemo(
    () => ({
      '/dashboard': createHoverHandler(prefetchDashboardData),
      // Add more route prefetch mappings as needed
    }),
    [createHoverHandler],
  );

  return navPrefetchMap;
}

/**
 * 路由预加载映射
 * 根据当前路由路径预加载对应页面数据
 */
const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': prefetchDashboardData,
  // Add more route prefetch mappings as needed
};

/**
 * 路由变化时自动预加载 Hook
 * 在组件中使用，当路由变化时自动预加载目标页面数据
 */
export function useRoutePrefetch() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = pathname || '/';

    if (previousPathname.current === currentPath) {
      return;
    }

    previousPathname.current = currentPath;

    const prefetchFn = routePrefetchMap[currentPath];

    if (prefetchFn) {
      prefetchFn().catch((error) => {
        logger.warn(`Failed to prefetch data for route ${currentPath}:`, error);
      });
    }
  }, [pathname]);
}
