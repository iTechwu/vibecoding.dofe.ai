'use client';

import { tsRestClient, analyticsClient } from '../client';

/**
 * Analytics Query Keys
 * Used for React Query cache management
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
  track: () => [...analyticsKeys.all, 'track'] as const,
  trackBatch: () => [...analyticsKeys.all, 'trackBatch'] as const,
};

// ============================================================================
// Analytics Mutation Hooks
// Analytics events are typically sent via mutations, not queries
// ============================================================================

/**
 * Track a single analytics event
 */
export function useTrackEvent() {
  return tsRestClient.analytics.track.useMutation();
}

/**
 * Track multiple analytics events in batch
 */
export function useTrackEventBatch() {
  return tsRestClient.analytics.trackBatch.useMutation();
}
