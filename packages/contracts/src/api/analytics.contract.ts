import { initContract } from '@ts-rest/core';
import { createApiResponse } from '../base';
import {
  AnalyticsEventSchema,
  BatchAnalyticsEventsSchema,
  AnalyticsResponseSchema,
} from '../schemas/analytics.schema';

const c = initContract();

const TrackResponseSchema = createApiResponse(AnalyticsResponseSchema);

/**
 * Analytics API Contract
 * 用于追踪用户行为和产品指标
 */
export const analyticsContract = c.router(
  {
    /**
     * Track a single analytics event
     * 追踪单个事件
     */
    track: {
      method: 'POST',
      path: '/track',
      body: AnalyticsEventSchema,
      responses: {
        200: TrackResponseSchema,
      },
      summary: '追踪单个事件',
      description: '记录单个用户行为事件',
    },

    /**
     * Track multiple analytics events in batch
     * 批量追踪事件
     */
    trackBatch: {
      method: 'POST',
      path: '/track/batch',
      body: BatchAnalyticsEventsSchema,
      responses: {
        200: TrackResponseSchema,
      },
      summary: '批量追踪事件',
      description: '批量记录多个用户行为事件，提高性能',
    },
  },
  {
    pathPrefix: '/analytics',
  },
);
