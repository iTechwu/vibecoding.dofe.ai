'use client';

import { tsRestClient, userClient } from '../client';

/**
 * User Query Keys
 * Used for React Query cache management
 */
export const userKeys = {
  all: ['user'] as const,
  info: () => [...userKeys.all, 'info'] as const,
  check: () => [...userKeys.all, 'check'] as const,
  contact: (userId: string) => [...userKeys.all, 'contact', userId] as const,
};

// ============================================================================
// User Info Hooks
// ============================================================================

/**
 * Get current user's account info
 */
export function useUserInfo() {
  return tsRestClient.user.getInfo.useQuery(userKeys.info(), {});
}

/**
 * Check user info (returns userId)
 */
export function useUserCheck() {
  return tsRestClient.user.check.useQuery(userKeys.check(), {});
}

/**
 * Get user contact info by userId
 * @param userId - User UUID
 */
export function useUserContact(userId: string) {
  const queryKey = userKeys.contact(userId);
  return tsRestClient.user.getContact.useQuery(
    queryKey,
    { params: { userId } },
    { queryKey, enabled: Boolean(userId) },
  );
}
