'use server';

import { revalidatePath } from 'next/cache';
import {
  decomposeLoop,
  generateLoopSpec,
  interveneLoopIssue,
  recordLoopShardImplementation,
  reviewLoopShard,
  reviewLoopSpec,
  runLoopShardTests,
} from '@/lib/api/loops';

export async function generateSpecAction(issueId: string) {
  await generateLoopSpec(issueId);
  revalidatePath(`/loops/${issueId}`);
}

export async function approveSpecAction(issueId: string) {
  await reviewLoopSpec(issueId, {
    action: 'approve',
    reviewer: 'human',
  });
  revalidatePath(`/loops/${issueId}`);
}

export async function requestRevisionAction(issueId: string, formData: FormData) {
  await reviewLoopSpec(issueId, {
    action: 'request-revision',
    reviewer: 'human',
    notes: String(formData.get('notes') ?? ''),
  });
  revalidatePath(`/loops/${issueId}`);
}

export async function decomposeAction(issueId: string) {
  await decomposeLoop(issueId);
  revalidatePath(`/loops/${issueId}`);
}

export async function pauseLoopAction(issueId: string) {
  await interveneLoopIssue(issueId, {
    action: 'pause',
    actor: 'human',
  });
  revalidatePath(`/loops/${issueId}`);
  revalidatePath('/loops');
}

export async function resumeLoopAction(issueId: string) {
  await interveneLoopIssue(issueId, {
    action: 'resume',
    actor: 'human',
  });
  revalidatePath(`/loops/${issueId}`);
  revalidatePath('/loops');
}

export async function takeShardAction(issueId: string, formData: FormData) {
  await interveneLoopIssue(issueId, {
    action: 'take',
    actor: 'human',
    shardId: String(formData.get('shardId') ?? ''),
    notes: String(formData.get('notes') ?? '') || undefined,
  });
  revalidatePath(`/loops/${issueId}`);
}

export async function runShardTestsAction(issueId: string, formData: FormData) {
  const shardId = String(formData.get('shardId') ?? '');
  const commands = String(formData.get('commands') ?? '')
    .split('\n')
    .map((command) => command.trim())
    .filter(Boolean);

  await runLoopShardTests(issueId, shardId, {
    commands: commands.length ? commands : undefined,
    runner: 'loops-runner',
  });
  revalidatePath(`/loops/${issueId}`);
}

export async function recordImplementationAction(issueId: string, formData: FormData) {
  const shardId = String(formData.get('shardId') ?? '');
  const changedFiles = String(formData.get('changedFiles') ?? '')
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);

  await recordLoopShardImplementation(issueId, shardId, {
    implementer: String(formData.get('implementer') ?? 'human') || 'human',
    summary: String(formData.get('summary') ?? ''),
    changedFiles,
    notes: String(formData.get('notes') ?? '') || undefined,
  });
  revalidatePath(`/loops/${issueId}`);
}

export async function reviewShardAction(issueId: string, formData: FormData) {
  const shardId = String(formData.get('shardId') ?? '');
  const issueText = String(formData.get('issues') ?? '').trim();
  const fixInstructions = String(formData.get('fixInstructions') ?? '')
    .split('\n')
    .map((instruction) => instruction.trim())
    .filter(Boolean);

  await reviewLoopShard(issueId, shardId, {
    reviewer: 'codex',
    verdict: String(formData.get('verdict') ?? 'NEEDS-WORK') as 'PASS' | 'NEEDS-WORK' | 'FAIL',
    summary: String(formData.get('summary') ?? ''),
    issues: issueText
      ? [
          {
            severity: String(formData.get('severity') ?? 'major') as 'minor' | 'major' | 'critical',
            desc: issueText,
          },
        ]
      : [],
    fixInstructions,
  });
  revalidatePath(`/loops/${issueId}`);
}
