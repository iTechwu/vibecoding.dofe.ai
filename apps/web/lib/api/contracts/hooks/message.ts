'use client';

import { useQueryClient } from '@tanstack/react-query';
import { tsRestClient, messageClient } from '../client';
import type { z } from 'zod';
import type { MessageListQuerySchema } from '@repo/contracts';

type MessageListQuery = z.input<typeof MessageListQuerySchema>;

/**
 * Message Query Keys
 * Used for React Query cache management
 */
export const messageKeys = {
  all: ['messages'] as const,
  list: (query?: MessageListQuery) =>
    [...messageKeys.all, 'list', query] as const,
  unreadCount: () => [...messageKeys.all, 'unreadCount'] as const,
};

// ============================================================================
// Message Query Hooks
// ============================================================================

/**
 * Get list of messages
 * @param query - Query parameters (page, limit, type, isRead)
 */
export function useMessages(query?: MessageListQuery) {
  const queryKey = messageKeys.list(query);
  const { page = 1, limit = 20, ...rest } = query ?? {};
  return tsRestClient.message.list.useQuery(
    queryKey,
    { query: { page, limit, ...rest } },
    { queryKey },
  );
}

/**
 * Get unread message count
 */
export function useUnreadMessageCount() {
  const queryKey = messageKeys.unreadCount();
  return tsRestClient.message.getUnreadCount.useQuery(queryKey, {});
}

// ============================================================================
// Message Mutation Hooks
// ============================================================================

/**
 * Set messages as read
 */
export function useSetMessagesRead() {
  const queryClient = useQueryClient();
  return tsRestClient.message.setRead.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}
