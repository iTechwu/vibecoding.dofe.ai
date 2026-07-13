import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoopAdvanceSSE } from './useLoopAdvanceSSE';

const ensureValidToken = vi.hoisted(() => vi.fn());
const isTokenExpired = vi.hoisted(() => vi.fn());

vi.mock('@/lib/token-manager', () => ({ ensureValidToken, isTokenExpired }));
vi.mock('@/config', () => ({ API_CONFIG: { baseUrl: 'https://api.example.test' } }));

type EventHandler = (event: MessageEvent<string>) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly listeners = new Map<string, EventHandler>();
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  onopen: (() => void) | null = null;

  constructor(
    readonly url: string,
    readonly init?: EventSourceInit,
  ) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventHandler) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }
}

describe('useLoopAdvanceSSE', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    ensureValidToken.mockResolvedValue('access-token');
    isTokenExpired.mockReturnValue(false);
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('consumes advance-status events and refreshes the issue caches', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['loops', 'detail', 'issue-1'], { issue: 'issue-1' });
    queryClient.setQueryData(['loops', 'list'], [{ id: 'issue-1' }]);
    queryClient.setQueryData(['loops', 'advance-status', 'issue-1'], null);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, unmount } = renderHook(() => useLoopAdvanceSSE('issue-1'), { wrapper });

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const source = MockEventSource.instances[0];
    if (!source) throw new Error('Expected an EventSource connection');
    expect(source.url).toBe(
      'https://api.example.test/issues/issue-1/advance-events?access_token=access-token',
    );
    expect(source.init).toEqual({ withCredentials: true });

    act(() => {
      source.onopen?.();
      source.emit('advance-status', {
        jobId: 'advance-issue-1',
        issueId: 'issue-1',
        status: 'active',
        attempt: 1,
        updatedAt: '2026-07-13T00:00:00.000Z',
        phase: 'PHASE_4_IMPLEMENT',
        issueStatus: 'IN_LOOP',
      });
    });

    await waitFor(() => {
      expect(result.current.status).toMatchObject({ status: 'active', attempt: 1 });
    });
    expect(result.current.isConnected).toBe(true);
    expect(queryClient.getQueryState(['loops', 'detail', 'issue-1'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['loops', 'list'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['loops', 'advance-status', 'issue-1'])?.isInvalidated).toBe(
      true,
    );

    unmount();
    expect(source.closed).toBe(true);
  });
});
