'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import type { LoopIssueListItem } from '@repo/contracts';
import { Button, Skeleton } from '@repo/ui';
import { Link } from '@/i18n/navigation';
import { formatLoopLabel } from '@/app/loops/loops-display';
import { selectActionableIssues } from './workbench-selectors';

interface ScheduledIssuesWorkbenchProps {
  isError: boolean;
  isLoading: boolean;
  items: LoopIssueListItem[];
  onRetry: () => void;
}

export function ScheduledIssuesWorkbench({
  isError,
  isLoading,
  items,
  onRetry,
}: ScheduledIssuesWorkbenchProps) {
  const locale = useLocale();
  const t = useTranslations('loops.dashboard.scheduled');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const scheduledIssues = selectActionableIssues(items).filter((item) => {
    if (!normalizedQuery) return true;
    return `${item.issue.title} ${item.issue.id}`.toLocaleLowerCase().includes(normalizedQuery);
  });

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-medium text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="mt-5">
        <label
          className="block max-w-md text-sm font-medium text-foreground"
          htmlFor="scheduled-search"
        >
          {t('searchLabel')}
        </label>
        <input
          className="mt-2 h-9 w-full max-w-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          id="scheduled-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          type="search"
          value={query}
        />
      </div>

      {isLoading ? (
        <div aria-busy="true" aria-label={t('loading')} className="mt-6 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-destructive/50 bg-destructive/10 p-4"
          role="alert"
        >
          <p className="text-sm text-foreground">{t('error')}</p>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : scheduledIssues.length === 0 ? (
        <p className="mt-6 border-y border-border py-6 text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul aria-label={t('title')} className="mt-6 divide-y divide-border border-y border-border">
          {scheduledIssues.map((item) => {
            const stateLabel = formatLoopLabel(
              item.state?.paused ? 'PAUSED' : (item.state?.phase ?? item.issue.status),
              locale,
            );
            return (
              <li key={item.issue.id}>
                <Link
                  className="block px-3 py-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`/loops/${item.issue.id}`}
                >
                  <p className="truncate text-sm font-medium text-foreground">{item.issue.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[stateLabel, item.issue.priority, item.issue.id].filter(Boolean).join(' · ')}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
