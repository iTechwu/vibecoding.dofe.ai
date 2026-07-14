'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ClipboardCheck, Clock3, Plus, RefreshCw } from 'lucide-react';
import { Button, Skeleton } from '@repo/ui';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useCreateSimpleLoopIssue,
  useLoopsList,
  useLoopsMetrics,
  useLoopsNotifications,
} from '@/lib/api/contracts/hooks';
import { buildReviewInbox } from '@/app/loops/loops-dashboard-model';
import { formatLoopLabel } from '@/app/loops/loops-display';
import { useState } from 'react';
import { IssueRequestComposer } from './issue-request-composer';
import { PageHeader } from './page-header';
import { selectActionableIssues, selectContinuationIssue } from './workbench-selectors';

const RECENT_ISSUE_LIMIT = 5;
const REVIEW_QUEUE_LIMIT = 4;

function IssueMeta({ phase, priority }: { phase?: string; priority?: string }) {
  return (
    <p className="mt-1 truncate text-xs text-muted-foreground">
      {[phase, priority].filter(Boolean).join(' · ')}
    </p>
  );
}

function HomeWorkbenchSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}

export function HomeWorkbench() {
  const locale = useLocale();
  const t = useTranslations('loops.dashboard.home');
  const conversation = useTranslations('loops.conversation');
  const router = useRouter();
  const listQuery = useLoopsList({ page: 1, limit: 20 });
  const metricsQuery = useLoopsMetrics();
  const notificationsQuery = useLoopsNotifications({ limit: 8 });
  const createIssue = useCreateSimpleLoopIssue();
  const [draft, setDraft] = useState('');
  const [submitError, setSubmitError] = useState<string>();

  const reviewIsLoading = metricsQuery.isLoading || notificationsQuery.isLoading;
  const reviewUnavailable = metricsQuery.isError || notificationsQuery.isError;
  const retryList = () => {
    void listQuery.refetch();
  };

  const createFromRequest = async (request: string) => {
    setSubmitError(undefined);
    try {
      const result = await createIssue.mutateAsync({ body: { request } });
      setDraft('');
      router.push(`/loops/${result.body.data.issue.id}`);
    } catch {
      setSubmitError(conversation('createError'));
    }
  };

  const composer = (
    <div className="mt-8 border-t border-border pt-5">
      <IssueRequestComposer
        draft={draft}
        error={submitError}
        labels={{
          label: conversation('composerLabel'),
          placeholder: conversation('composerPlaceholder'),
          hint: conversation('composerHint'),
          send: conversation('send'),
        }}
        onChange={setDraft}
        onSubmit={(request) => void createFromRequest(request)}
        pending={createIssue.isPending}
      />
    </div>
  );

  if (listQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground"
        >
          <p>{t('loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={retryList}>
            <RefreshCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (listQuery.isLoading) return <HomeWorkbenchSkeleton label={t('loadingLabel')} />;

  const items = listQuery.data?.body.data.list ?? [];
  const continuation = selectContinuationIssue(items);
  const reviewInbox = reviewUnavailable
    ? []
    : buildReviewInbox(
        metricsQuery.data?.body.data.actionQueue ?? [],
        notificationsQuery.data?.body.data.notifications,
        locale,
      ).slice(0, REVIEW_QUEUE_LIMIT);
  const recentIssues = selectActionableIssues(items).slice(0, RECENT_ISSUE_LIMIT);

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <PageHeader title={t('title')} description={t('subtitle')} />
        <section className="mt-8 border-y border-border py-10 text-center">
          <ClipboardCheck aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
          <h2 className="mt-3 text-base font-medium">{t('emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
          <Button asChild className="mt-4">
            <Link href="/loops/new">
              <Plus aria-hidden="true" />
              {t('newIssue')}
            </Link>
          </Button>
          {composer}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button asChild size="sm">
            <Link href="/loops/new">
              <Plus aria-hidden="true" />
              {t('newIssue')}
            </Link>
          </Button>
        }
      />

      {continuation ? (
        <section className="mt-6" aria-labelledby="continue-heading">
          <div className="mb-2 flex items-center gap-2">
            <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 id="continue-heading" className="text-sm font-medium">
              {t('continueTitle')}
            </h2>
          </div>
          <div className="flex flex-col gap-3 border border-border bg-card px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{continuation.issue.title}</p>
              <IssueMeta
                phase={formatLoopLabel(
                  continuation.state?.paused
                    ? 'PAUSED'
                    : (continuation.state?.phase ?? continuation.issue.status),
                  locale,
                )}
                priority={continuation.issue.priority}
              />
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/loops/${continuation.issue.id}`}>
                {t('continueAction')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="review-heading">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="review-heading" className="text-sm font-medium">
              {t('reviewTitle')}
            </h2>
            <Link
              href="/loops#review-inbox"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('viewAll')}
            </Link>
          </div>
          {reviewIsLoading ? (
            <p className="border-y border-border px-3 py-4 text-sm text-muted-foreground">
              {t('reviewLoading')}
            </p>
          ) : reviewUnavailable ? (
            <p className="border-y border-border px-3 py-4 text-sm text-muted-foreground">
              {t('reviewUnavailable')}
            </p>
          ) : reviewInbox.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {reviewInbox.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-label={t('openReview', { title: item.title })}
                    className="block px-3 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.label} · {item.meta}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-border px-3 py-4 text-sm text-muted-foreground">
              {t('reviewEmpty')}
            </p>
          )}
        </section>

        <section aria-labelledby="scheduled-heading">
          <h2 id="scheduled-heading" className="mb-2 text-sm font-medium">
            {t('scheduledTitle')}
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {recentIssues.map((item) => (
              <li key={item.issue.id}>
                <Link
                  href={`/loops/${item.issue.id}`}
                  className="block px-3 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="truncate text-sm font-medium">{item.issue.title}</p>
                  <IssueMeta
                    phase={formatLoopLabel(
                      item.state?.paused ? 'PAUSED' : (item.state?.phase ?? item.issue.status),
                      locale,
                    )}
                    priority={item.issue.priority}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {composer}
    </div>
  );
}
