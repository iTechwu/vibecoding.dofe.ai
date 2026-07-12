'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ClipboardCheck, Clock3, Plus, RefreshCw } from 'lucide-react';
import { Button, Skeleton } from '@repo/ui';
import { Link } from '@/i18n/navigation';
import { useLoopsList, useLoopsMetrics, useLoopsNotifications } from '@/lib/api/contracts/hooks';
import { buildReviewInbox } from '@/app/loops/loops-dashboard-model';
import { formatLoopLabel } from '@/app/loops/loops-display';
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

function HomeWorkbenchSkeleton() {
  return (
    <main aria-label="Loading home workbench" className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </main>
  );
}

export function HomeWorkbench() {
  const locale = useLocale();
  const t = useTranslations('loops.dashboard.home');
  const listQuery = useLoopsList({ page: 1, limit: 20 });
  const metricsQuery = useLoopsMetrics();
  const notificationsQuery = useLoopsNotifications({ limit: 8 });

  const isLoading = listQuery.isLoading || metricsQuery.isLoading || notificationsQuery.isLoading;
  const hasError = listQuery.isError || metricsQuery.isError || notificationsQuery.isError;
  const retry = () => {
    void Promise.all([listQuery.refetch(), metricsQuery.refetch(), notificationsQuery.refetch()]);
  };

  if (hasError) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground"
        >
          <p>{t('loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            <RefreshCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      </main>
    );
  }

  if (isLoading) return <HomeWorkbenchSkeleton />;

  const items = listQuery.data?.body.data.list ?? [];
  const continuation = selectContinuationIssue(items);
  const reviewInbox = buildReviewInbox(
    metricsQuery.data?.body.data.actionQueue ?? [],
    notificationsQuery.data?.body.data.notifications,
    locale,
  ).slice(0, REVIEW_QUEUE_LIMIT);
  const recentIssues = selectActionableIssues(items).slice(0, RECENT_ISSUE_LIMIT);

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
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
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
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
          <Link
            href={`/loops/${continuation.issue.id}`}
            className="group block border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
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
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </Link>
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
          {reviewInbox.length > 0 ? (
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

        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-2 text-sm font-medium">
            {t('recentTitle')}
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
    </main>
  );
}
