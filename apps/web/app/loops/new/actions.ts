'use server';

import { redirect } from 'next/navigation';
import { createLoopIssue } from '@/lib/api/loops';

export async function createLoopIssueAction(formData: FormData) {
  const acceptanceCriteria = String(formData.get('acceptanceCriteria') ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const result = await createLoopIssue({
    title: String(formData.get('title') ?? ''),
    targetRepo: String(formData.get('targetRepo') ?? ''),
    body: String(formData.get('body') ?? ''),
    priority: (String(formData.get('priority') ?? 'P2') || 'P2') as 'P0' | 'P1' | 'P2' | 'P3',
    acceptanceCriteria,
    submitterId: String(formData.get('submitterId') ?? 'mock-user'),
    submitterName: String(formData.get('submitterName') ?? 'Mock User'),
  });

  redirect(`/loops/${result.issue.id}`);
}
