'use client';

import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import {
  ArrowUp,
  Bot,
  CircleDot,
  ExternalLink,
  LoaderCircle,
  MessageSquarePlus,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useCreateSimpleLoopIssue, useLoopsList } from '@/lib/api/contracts/hooks';
import { useLoopAdvanceSSE } from '@/hooks/useLoopAdvanceSSE';
import { useTranslations } from 'next-intl';

const MINIMUM_REQUEST_LENGTH = 10;

function formatIssueRequest(issue: { body?: string; title: string }) {
  return issue.body?.trim() || issue.title;
}

export function LoopsConversationWorkbench() {
  const t = useTranslations('loops.conversation');
  const listQuery = useLoopsList({ page: 1, limit: 30 });
  const createIssue = useCreateSimpleLoopIssue();
  const issues = useMemo(() => listQuery.data?.body.data.list ?? [], [listQuery.data]);
  const [draft, setDraft] = useState('');
  const [submittedRequests, setSubmittedRequests] = useState<string[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const activeIssueId = selectedIssueId ?? issues[0]?.issue.id ?? '';
  const advanceStream = useLoopAdvanceSSE(activeIssueId, { enabled: Boolean(activeIssueId) });
  const orderedIssues = useMemo(
    () => [...issues].sort((left, right) => right.issue.updated.localeCompare(left.issue.updated)),
    [issues],
  );

  const submitRequest = async () => {
    const request = draft.trim();
    if (request.length < MINIMUM_REQUEST_LENGTH || createIssue.isPending) return;

    setSubmitError(undefined);
    setSubmittedRequests((current) => [...current, request]);
    setDraft('');
    try {
      const result = await createIssue.mutateAsync({ body: { request } });
      setSelectedIssueId(result.body.data.issue.id);
      await listQuery.refetch();
    } catch {
      setSubmitError(t('createError'));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitRequest();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void submitRequest();
  };

  return (
    <main className="flex min-h-full flex-col bg-background">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{t('eyebrow')}</p>
          <h1 className="mt-1 text-lg font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <CircleDot aria-hidden="true" className="size-3 text-emerald-500" />
          {t('connection')}
        </div>
      </header>

      <section
        aria-label={t('historyLabel')}
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6"
      >
        {listQuery.isLoading ? (
          <div aria-busy="true" className="space-y-4">
            <div className="h-20 animate-pulse border border-border bg-muted/40" />
            <div className="h-16 animate-pulse border border-border bg-muted/30" />
          </div>
        ) : null}

        {!listQuery.isLoading && orderedIssues.length === 0 && submittedRequests.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
            <MessageSquarePlus aria-hidden="true" className="size-6 text-muted-foreground" />
            <h2 className="mt-4 text-base font-medium">{t('emptyTitle')}</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('emptyDescription')}</p>
          </div>
        ) : null}

        {submittedRequests.map((request, index) => (
          <article
            className="ml-auto max-w-[90%] border border-border bg-muted/50 px-4 py-3 sm:max-w-[76%]"
            key={`${request}-${index}`}
          >
            <p className="text-xs font-medium text-muted-foreground">{t('requestLabel')}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{request}</p>
          </article>
        ))}

        {orderedIssues.map((item) => {
          const isSelected = item.issue.id === activeIssueId;
          const streamStatus = isSelected ? advanceStream.status : null;
          const stateLabel = streamStatus
            ? t(`status.${streamStatus.status}`)
            : item.state?.paused
              ? t('status.waiting')
              : item.issue.status === 'CLOSED'
                ? t('status.completed')
                : t('status.ready');

          return (
            <div className="space-y-3" key={item.issue.id}>
              <button
                aria-pressed={isSelected}
                className="ml-auto block max-w-[90%] border border-border bg-muted/50 px-4 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[76%]"
                onClick={() => setSelectedIssueId(item.issue.id)}
                type="button"
              >
                <p className="text-xs font-medium text-muted-foreground">{t('requestLabel')}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {formatIssueRequest(item.issue)}
                </p>
              </button>

              <article className="max-w-[94%] border-l-2 border-foreground/70 pl-4 sm:max-w-[82%]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Bot aria-hidden="true" className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{item.issue.title}</p>
                  <span className="text-xs text-muted-foreground">{stateLabel}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t('issueCreated')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('issueMeta', { id: item.issue.id, priority: item.issue.priority })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={`/loops/${item.issue.id}`}
                  >
                    {t('openIssue')}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              </article>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-0 shrink-0 border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <form className="mx-auto w-full max-w-4xl" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="loops-conversation-composer">
            {t('composerLabel')}
          </label>
          <div className="flex items-end gap-2 border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
            <textarea
              className="min-h-18 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
              id="loops-conversation-composer"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={t('composerPlaceholder')}
              value={draft}
            />
            <button
              aria-label={t('send')}
              className="inline-flex size-9 shrink-0 items-center justify-center bg-foreground text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              disabled={draft.trim().length < MINIMUM_REQUEST_LENGTH || createIssue.isPending}
              type="submit"
            >
              {createIssue.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <ArrowUp aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <p>{t('composerHint')}</p>
            {submitError ? <p role="alert">{submitError}</p> : null}
          </div>
        </form>
      </div>
    </main>
  );
}
