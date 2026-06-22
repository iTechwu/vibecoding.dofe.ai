'use client';

import type { FormEvent } from 'react';
import {
  useAdvanceLoop,
  useDecomposeLoop,
  useFinalizeLoop,
  useGenerateLoopSpec,
  useInterveneLoop,
  useReloopIssue,
  useResumeLoops,
  useReviewLoopGlobal,
  useReviewLoopSpec,
  useRunLoop,
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
  const generateSpec = useGenerateLoopSpec(issueId);
  const advance = useAdvanceLoop(issueId);
  const reviewSpec = useReviewLoopSpec(issueId);
  const decompose = useDecomposeLoop(issueId);
  const runLoop = useRunLoop(issueId);
  const reviewGlobal = useReviewLoopGlobal(issueId);
  const reloopMutation = useReloopIssue(issueId);
  const finalize = useFinalizeLoop(issueId);
  const intervene = useInterveneLoop(issueId);
  const resumeInterrupted = useResumeLoops();
  const operations = collectOperationState([
    generateSpec,
    advance,
    reviewSpec,
    decompose,
    runLoop,
    reviewGlobal,
    reloopMutation,
    finalize,
    intervene,
    resumeInterrupted,
  ]);

  return {
    operations,
    advanceLoop: () => advance.mutate({ params: { issueId }, body: {} }),
    generateSpec: () => generateSpec.mutate({ params: { issueId }, body: {} }),
    approveSpec: () =>
      reviewSpec.mutate({
        params: { issueId },
        body: { action: 'approve', reviewer: 'human' },
      }),
    decompose: () => decompose.mutate({ params: { issueId }, body: {} }),
    runLoop: () => runLoop.mutate({ params: { issueId }, body: {} }),
    resumeInterrupted: () => resumeInterrupted.mutate({ body: {} }),
    globalReview: () => reviewGlobal.mutate({ params: { issueId }, body: {} }),
    finalizeLoop: () => finalize.mutate({ params: { issueId }, body: {} }),
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
  };
}
