import path from 'node:path';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/workbench/page-header';
import SimpleLoopIssueForm from './simple-loop-issue-form';

// Resolve the workspace root server-side so the default `targetRepo` is portable
// across machines (the web app runs from `apps/web`, so the repo root is `../..`).
// `NEXT_PUBLIC_LOOPS_DEFAULT_REPO` overrides this when set.
const defaultTargetRepo =
  process.env.NEXT_PUBLIC_LOOPS_DEFAULT_REPO ?? path.resolve(process.cwd(), '../..');

export default async function NewLoopIssuePage() {
  const t = await getTranslations('loops.newIssue');

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        action={
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            href="/loops"
          >
            {t('back')}
          </Link>
        }
        description={t('workbench.subtitle')}
        eyebrow={t('eyebrow')}
        title={t('title')}
      />
      <div className="pt-6">
        <SimpleLoopIssueForm defaultTargetRepo={defaultTargetRepo} />
      </div>
    </section>
  );
}
