'use client';

import { ClipboardList, RefreshCw } from 'lucide-react';
import type { LoopIssueListItem } from '@repo/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { selectActionableIssues } from '@/components/workbench/workbench-selectors';
import { formatLoopLabel } from './loops-display';

type LoopsIssuesViewProps = {
  items: LoopIssueListItem[];
  isLoading: boolean;
  isError: boolean;
  isFiltered?: boolean;
  onRetry: () => void;
};

function IssuesSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-2">
      <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function LoopsIssuesView({
  items,
  isLoading,
  isError,
  isFiltered = false,
  onRetry,
}: LoopsIssuesViewProps) {
  const locale = useLocale();
  const t = useTranslations('loops.dashboard.issues');

  return (
    <section
      aria-labelledby="issues-title"
      className="rounded-lg border border-white/10 bg-card/80 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h2 className="mt-1 text-base font-semibold" id="issues-title">
            {t('title')}
          </h2>
        </div>
        <ClipboardList aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <IssuesSkeleton label={t('loading')} />
        ) : isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
          >
            <p>{t('error')}</p>
            <button
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted/50"
              onClick={onRetry}
              type="button"
            >
              <RefreshCw aria-hidden="true" />
              {t('retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center">
            <p className="text-base font-medium">
              {isFiltered ? t('noMatchesTitle') : t('emptyTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFiltered ? t('noMatchesDescription') : t('emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-md border border-border">
            {selectActionableIssues(items).map(({ issue, state }) => (
              <Link
                className="flex min-w-0 items-center justify-between gap-4 px-3 py-3 text-sm transition hover:bg-muted/30"
                href={`/loops/${issue.id}`}
                key={issue.id}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{issue.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {formatLoopLabel(
                      state?.paused ? 'PAUSED' : (state?.phase ?? issue.status),
                      locale,
                    )}
                    {' · '}
                    {issue.priority}
                    {issue.targetRepo ? ` · ${issue.targetRepo}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{issue.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
