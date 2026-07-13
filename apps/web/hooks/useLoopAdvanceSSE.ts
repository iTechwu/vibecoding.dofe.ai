'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoopAdvanceJobStatusSchema, type LoopAdvanceJobStatus } from '@repo/contracts';
import { API_CONFIG } from '@/config';
import { ensureValidToken, isTokenExpired } from '@/lib/token-manager';

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const TOKEN_CHECK_INTERVAL_MS = 30_000;

type UseLoopAdvanceSSEOptions = {
  enabled?: boolean;
};

type UseLoopAdvanceSSEReturn = {
  status: LoopAdvanceJobStatus | null;
  isConnected: boolean;
};

/**
 * Streams durable advance-job state for one issue. HTTP status polling remains
 * the fallback; stream events only invalidate the exact affected query keys.
 */
export function useLoopAdvanceSSE(
  issueId: string,
  { enabled = true }: UseLoopAdvanceSSEOptions = {},
): UseLoopAdvanceSSEReturn {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LoopAdvanceJobStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !issueId) return;

    let disposed = false;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const close = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };

    const scheduleReconnect = () => {
      if (disposed || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        void connect();
      }, retryDelay);
    };

    const connect = async () => {
      close();
      setIsConnected(false);

      try {
        const token = await ensureValidToken();
        if (disposed || !token) return;

        const url = new URL(
          `/issues/${encodeURIComponent(issueId)}/advance-events`,
          API_CONFIG.baseUrl,
        );
        url.searchParams.set('access_token', token);

        const source = new EventSource(url.toString(), { withCredentials: true });
        eventSourceRef.current = source;
        source.onopen = () => {
          retryDelay = INITIAL_RETRY_DELAY_MS;
          setIsConnected(true);
        };
        source.addEventListener('advance-status', (event) => {
          try {
            const parsed = LoopAdvanceJobStatusSchema.safeParse(JSON.parse(event.data));
            if (!parsed.success || parsed.data.issueId !== issueId) return;

            setStatus(parsed.data);
            queryClient.invalidateQueries({ queryKey: ['loops', 'detail', issueId] });
            queryClient.invalidateQueries({ queryKey: ['loops', 'list'] });
            queryClient.invalidateQueries({ queryKey: ['loops', 'advance-status', issueId] });
          } catch {
            // Ignore malformed frames and keep the fallback polling path active.
          }
        });
        source.onerror = () => {
          if (disposed || eventSourceRef.current !== source) return;
          setIsConnected(false);
          close();
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    const tokenCheckTimer = setInterval(() => {
      if (isTokenExpired()) void connect();
    }, TOKEN_CHECK_INTERVAL_MS);
    void connect();

    return () => {
      disposed = true;
      clearInterval(tokenCheckTimer);
      if (retryTimer) clearTimeout(retryTimer);
      close();
    };
  }, [enabled, issueId, queryClient]);

  return {
    status: status?.issueId === issueId ? status : null,
    isConnected,
  };
}
