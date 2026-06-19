'use client';

import { tsRestClient, systemClient } from '../client';

/**
 * System Query Keys
 * Used for React Query cache management
 */
export const systemKeys = {
  all: ['system'] as const,
  permissionConfig: () => [...systemKeys.all, 'permissionConfig'] as const,
  ready: () => [...systemKeys.all, 'ready'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
};

// ============================================================================
// System Query Hooks
// ============================================================================

/**
 * Get permission configuration
 */
export function usePermissionConfig() {
  return tsRestClient.system.getPermissionConfig.useQuery(
    systemKeys.permissionConfig(),
    {},
  );
}

/**
 * Check if service is ready
 */
export function useServiceReady() {
  return tsRestClient.system.checkServiceReady.useQuery(systemKeys.ready(), {});
}

/**
 * Check service health status
 */
export function useServiceHealth() {
  return tsRestClient.system.checkHealth.useQuery(systemKeys.health(), {});
}
