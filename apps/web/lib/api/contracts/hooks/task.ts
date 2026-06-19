'use client';

import { useQueryClient } from '@tanstack/react-query';
import { tsRestClient, taskClient } from '../client';

/**
 * Task Query Keys
 * Used for React Query cache management
 */
export const taskKeys = {
  all: ['tasks'] as const,
  check: (taskId: string) => [...taskKeys.all, 'check', taskId] as const,
  list: () => [...taskKeys.all, 'list'] as const,
};

// ============================================================================
// Task Query Hooks
// ============================================================================

/**
 * Check if a task is completed
 * @param taskId - Task UUID
 */
export function useCheckTask(taskId: string) {
  const queryKey = taskKeys.check(taskId);
  return tsRestClient.task.checkTask.useQuery(
    queryKey,
    { params: { taskId } },
    { queryKey, enabled: Boolean(taskId) },
  );
}

/**
 * Get user's task list
 */
export function useTaskList() {
  return tsRestClient.task.getTaskList.useQuery(taskKeys.list(), {});
}

// ============================================================================
// Task Mutation Hooks
// ============================================================================

/**
 * Check multiple tasks completion status
 */
export function useCheckTasks() {
  const queryClient = useQueryClient();
  return tsRestClient.task.checkTasks.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
