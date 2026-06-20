'use client';

import type { FormEvent } from 'react';
import {
  useDecomposeLoop,
  useFinalizeLoop,
  useGenerateLoopSpec,
  useInterveneLoop,
  useRecordLoopShardImplementation,
  useReloopIssue,
  useReviewLoopGlobal,
  useReviewLoopShard,
  useReviewLoopSpec,
  useRunLoop,
  useRunLoopShardTests,
} from '@/lib/api/contracts/hooks';

type Verdict = 'PASS' | 'NEEDS-WORK' | 'FAIL';
type Severity = 'minor' | 'major' | 'critical';

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
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
  const reviewSpec = useReviewLoopSpec(issueId);
  const decompose = useDecomposeLoop(issueId);
  const runLoop = useRunLoop(issueId);
  const reviewGlobal = useReviewLoopGlobal(issueId);
  const reloopMutation = useReloopIssue(issueId);
  const finalize = useFinalizeLoop(issueId);
  const intervene = useInterveneLoop(issueId);
  const runShardTests = useRunLoopShardTests(issueId);
  const recordImplementation = useRecordLoopShardImplementation(issueId);
  const reviewShard = useReviewLoopShard(issueId);

  return {
    generateSpec: () => generateSpec.mutate({ params: { issueId }, body: {} }),
    approveSpec: () =>
      reviewSpec.mutate({
        params: { issueId },
        body: { action: 'approve', reviewer: 'human' },
      }),
    decompose: () => decompose.mutate({ params: { issueId }, body: {} }),
    runLoop: () => runLoop.mutate({ params: { issueId }, body: {} }),
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
    takeShard: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      intervene.mutate({
        params: { issueId },
        body: {
          action: 'take',
          actor: 'human',
          shardId: String(data.get('shardId') ?? ''),
          notes: String(data.get('notes') ?? '') || undefined,
        },
      });
    },
    runShardTests: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const shardId = String(data.get('shardId') ?? '');
      const commands = lines(String(data.get('commands') ?? ''));
      runShardTests.mutate({
        params: { issueId, shardId },
        body: { commands: commands.length ? commands : undefined, runner: 'loops-runner' },
      });
    },
    recordImplementation: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const shardId = String(data.get('shardId') ?? '');
      recordImplementation.mutate({
        params: { issueId, shardId },
        body: {
          implementer: String(data.get('implementer') ?? 'human') || 'human',
          summary: String(data.get('summary') ?? ''),
          changedFiles: lines(String(data.get('changedFiles') ?? '')),
          notes: String(data.get('notes') ?? '') || undefined,
        },
      });
    },
    reviewShard: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const shardId = String(data.get('shardId') ?? '');
      const issueText = String(data.get('issues') ?? '').trim();
      reviewShard.mutate({
        params: { issueId, shardId },
        body: {
          reviewer: 'codex',
          verdict: (String(data.get('verdict') ?? 'NEEDS-WORK') as Verdict) || 'NEEDS-WORK',
          summary: String(data.get('summary') ?? ''),
          issues: issueText
            ? [
                {
                  severity: (String(data.get('severity') ?? 'major') as Severity) || 'major',
                  desc: issueText,
                },
              ]
            : [],
          fixInstructions: lines(String(data.get('fixInstructions') ?? '')),
        },
      });
    },
  };
}
