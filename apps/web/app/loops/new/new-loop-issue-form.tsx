'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers';
import { useCreateLoopIssue } from '@/lib/api/contracts/hooks';

interface NewLoopIssueFormProps {
  /** Server-resolved workspace root; overridable via NEXT_PUBLIC_LOOPS_DEFAULT_REPO. */
  defaultTargetRepo: string;
}

/**
 * Client-side Loops issue intake.
 *
 * Submitting calls the authenticated ts-rest `createIssue` endpoint — the
 * submitter is derived server-side from the logged-in SSO user (provider
 * `dofe-sso`), so the client never sends identity. Unauthenticated visitors are
 * bounced to /login; the global 401 handler in `customFetch` is the backstop.
 */
export default function NewLoopIssueForm({ defaultTargetRepo }: NewLoopIssueFormProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const createIssue = useCreateLoopIssue();

  const [title, setTitle] = useState('');
  const [targetRepo, setTargetRepo] = useState(defaultTargetRepo);
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P2');
  const [body, setBody] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">Redirecting to login…</p>;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const criteria = acceptanceCriteria
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const result = await createIssue.mutateAsync({
      body: { title, targetRepo, body, priority, acceptanceCriteria: criteria },
    });
    const issueId = result.body.data.issue.id;
    router.push(`/loops/${issueId}`);
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Title
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          onChange={(e) => setTitle(e.target.value)}
          required
          value={title}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Target Repository
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          onChange={(e) => setTargetRepo(e.target.value)}
          required
          value={targetRepo}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Priority
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            onChange={(e) => setPriority(e.target.value as 'P0' | 'P1' | 'P2' | 'P3')}
            value={priority}
          >
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Requirement Body
        <textarea
          className="min-h-36 rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => setBody(e.target.value)}
          required
          value={body}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Acceptance Criteria
        <textarea
          className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => setAcceptanceCriteria(e.target.value)}
          placeholder="One acceptance item per line"
          required
          value={acceptanceCriteria}
        />
      </label>

      {createIssue.isError ? (
        <p className="text-sm text-destructive">Failed to create issue. Please try again.</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted/30"
          href="/loops"
        >
          Cancel
        </Link>
        <button
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
          disabled={createIssue.isPending}
          type="submit"
        >
          {createIssue.isPending ? 'Creating…' : 'Create Issue'}
        </button>
      </div>
    </form>
  );
}
