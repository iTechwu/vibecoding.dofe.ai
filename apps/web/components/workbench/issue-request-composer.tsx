'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';

const MINIMUM_REQUEST_LENGTH = 10;

export interface IssueRequestComposerLabels {
  label: string;
  placeholder: string;
  hint: string;
  send: string;
}

interface IssueRequestComposerProps {
  draft: string;
  error?: string;
  labels: IssueRequestComposerLabels;
  onChange: (value: string) => void;
  onSubmit: (request: string) => void;
  pending: boolean;
}

export function IssueRequestComposer({
  draft,
  error,
  labels,
  onChange,
  onSubmit,
  pending,
}: IssueRequestComposerProps) {
  const canSubmit = draft.trim().length >= MINIMUM_REQUEST_LENGTH && !pending;

  const submit = () => {
    const request = draft.trim();
    if (request.length < MINIMUM_REQUEST_LENGTH || pending) return;
    onSubmit(request);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="issue-request-composer">
        {labels.label}
      </label>
      <div className="flex items-end gap-2 border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
        <textarea
          className="min-h-18 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
          id="issue-request-composer"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={labels.placeholder}
          value={draft}
        />
        <button
          aria-label={labels.send}
          className="inline-flex size-9 shrink-0 items-center justify-center bg-foreground text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canSubmit}
          type="submit"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ArrowUp aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <p>{labels.hint}</p>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </form>
  );
}
