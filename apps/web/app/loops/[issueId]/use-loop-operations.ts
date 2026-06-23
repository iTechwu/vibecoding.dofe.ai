'use client';

import type { FormEvent } from 'react';
import {
  useAdvanceLoop,
  useGovernLoopDelivery,
  useInterveneLoop,
  useReloopIssue,
  useRunLoopBrowserQa,
  useRunLoopSecondOpinion,
  useResolveSecondOpinion,
  useReviewLoopSpec,
} from '@/lib/api/contracts/hooks';

interface OperationState {
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
}

function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const maybeError = error as {
      body?: { msg?: unknown; message?: unknown };
      message?: unknown;
    };
    const message = maybeError.body?.msg ?? maybeError.body?.message ?? maybeError.message;
    if (typeof message === 'string') return message;
  }
  return undefined;
}

function collectOperationState(states: OperationState[]) {
  const failed = states.find((state) => state.isError);
  return {
    isPending: states.some((state) => state.isPending),
    errorMessage: failed ? errorMessage(failed.error) : undefined,
  };
}

/**
 * Authenticated Loops issue operations for the detail console.
 *
 * Each handler calls the ts-rest mutation derived from the logged-in SSO user's
 * token (attached by `customFetch`). Form-driven handlers read values from the
 * submitted `<form>` via `FormData`, mirroring the previous server-action shapes.
 * Successful mutations invalidate the issue detail + list (see the hook layer).
 */
export function useFormState(issueId: string) {
  const advance = useAdvanceLoop(issueId);
  const reviewSpec = useReviewLoopSpec(issueId);
  const reloopMutation = useReloopIssue(issueId);
  const intervene = useInterveneLoop(issueId);
  const browserQa = useRunLoopBrowserQa(issueId);
  const secondOpinion = useRunLoopSecondOpinion(issueId);
  const resolveSecondOpinion = useResolveSecondOpinion(issueId);
  const deliveryGovernance = useGovernLoopDelivery(issueId);
  const operations = collectOperationState([
    advance,
    reviewSpec,
    reloopMutation,
    intervene,
    browserQa,
    secondOpinion,
    resolveSecondOpinion,
    deliveryGovernance,
  ]);

  return {
    operations,
    advanceLoop: () => advance.mutate({ params: { issueId }, body: {} }),
    approveSpec: () =>
      reviewSpec.mutate({
        params: { issueId },
        body: { action: 'approve', reviewer: 'human' },
      }),
    pauseLoop: () =>
      intervene.mutate({
        params: { issueId },
        body: { action: 'pause', actor: 'human' },
      }),
    resumeLoop: () =>
      intervene.mutate({
        params: { issueId },
        body: { action: 'resume', actor: 'human' },
      }),
    requestRevision: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const notes = String(new FormData(event.currentTarget).get('notes') ?? '');
      reviewSpec.mutate({
        params: { issueId },
        body: { action: 'request-revision', reviewer: 'human', notes },
      });
    },
    reloop: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const notes = String(new FormData(event.currentTarget).get('notes') ?? '') || undefined;
      reloopMutation.mutate({ params: { issueId }, body: { reviewer: 'human', notes } });
    },
    runBrowserQa: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const targetUrl = String(form.get('targetUrl') ?? '').trim();
      const checkedFlows = String(form.get('checkedFlows') ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const notes = String(form.get('notes') ?? '').trim() || undefined;
      const authSessionRef = String(form.get('authSessionRef') ?? '').trim() || undefined;
      const viewportSelection = String(form.get('viewports') ?? 'desktop');
      const viewports =
        viewportSelection === 'all'
          ? [
              { name: 'desktop', width: 1440, height: 900 },
              { name: 'tablet', width: 768, height: 1024 },
              { name: 'mobile', width: 375, height: 812 },
            ]
          : viewportSelection === 'tablet'
            ? [{ name: 'tablet', width: 768, height: 1024 }]
            : viewportSelection === 'mobile'
              ? [{ name: 'mobile', width: 375, height: 812 }]
              : [{ name: 'desktop', width: 1440, height: 900 }];
      browserQa.mutate({
        params: { issueId },
        body: {
          targetUrl,
          checkedFlows: checkedFlows.length > 0 ? checkedFlows : ['page-load'],
          notes,
          authSessionRef,
          viewports,
        },
      });
    },
    runSecondOpinion: () => secondOpinion.mutate({ params: { issueId }, body: {} }),
    acceptPrimaryFindings: () =>
      resolveSecondOpinion.mutate({
        params: { issueId },
        body: { action: 'accept-primary' },
      }),
    acceptSecondaryFindings: () =>
      resolveSecondOpinion.mutate({
        params: { issueId },
        body: { action: 'accept-secondary' },
      }),
    waiveSecondOpinion: (reason?: string) =>
      resolveSecondOpinion.mutate({
        params: { issueId },
        body: { action: 'waive', reason },
      }),
    requireSecondOpinion: () =>
      deliveryGovernance.mutate({
        params: { issueId },
        body: {
          action: 'set-second-opinion-policy',
          requiredForRelease: true,
          conflictHumanGate: true,
          actor: 'human',
          reason: 'Require Claude Code second opinion before release.',
        },
      }),
    recordReleaseCanary: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const targetUrl = String(form.get('targetUrl') ?? '').trim() || undefined;
      const status = String(form.get('status') ?? 'pending') as 'pending' | 'passed' | 'failed';
      const reason = String(form.get('reason') ?? '').trim() || undefined;
      deliveryGovernance.mutate({
        params: { issueId },
        body: {
          action: 'record-release-canary',
          status,
          targetUrl,
          actor: 'human',
          reason,
        },
      });
    },
    setBrowserQaSessionPolicy: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const authMode = String(form.get('authMode') ?? 'none') as
        | 'none'
        | 'test-account'
        | 'manual-session';
      const testAccountRef = String(form.get('testAccountRef') ?? '').trim() || undefined;
      const reason = String(form.get('reason') ?? '').trim() || undefined;
      deliveryGovernance.mutate({
        params: { issueId },
        body: {
          action: 'set-browser-qa-session-policy',
          authMode,
          testAccountRef,
          actor: 'human',
          reason,
        },
      });
    },
    recordRuntimeOverride: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const scope = String(form.get('scope') ?? 'network') as 'network' | 'write' | 'shell';
      const reason = String(form.get('reason') ?? '').trim();
      const expiresAt =
        String(form.get('expiresAt') ?? '').trim() ||
        new Date(Date.now() + 60 * 60 * 1000).toISOString();
      deliveryGovernance.mutate({
        params: { issueId },
        body: {
          action: 'record-runtime-override',
          scope,
          actor: 'human',
          reason: reason || 'Temporary runtime override.',
          expiresAt,
        },
      });
    },
  };
}
