import path from 'node:path';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import SimpleLoopIssueForm from './simple-loop-issue-form';

// Resolve the workspace root server-side so the default `targetRepo` is portable
// across machines (the web app runs from `apps/web`, so the repo root is `../..`).
// `NEXT_PUBLIC_LOOPS_DEFAULT_REPO` overrides this when set.
const defaultTargetRepo =
  process.env.NEXT_PUBLIC_LOOPS_DEFAULT_REPO ?? path.resolve(process.cwd(), '../..');

export default async function NewLoopIssuePage() {
  const t = await getTranslations('loops.newIssue');

  return (
    <main className="dark min-h-screen bg-[#0b0b0d] px-4 py-4 text-foreground sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-card/80">
          <div className="flex flex-col gap-4 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t('eyebrow')}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-balance">
                {t('title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {t('workbench.subtitle')}
              </p>
            </div>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background/70 px-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              href="/loops"
            >
              {t('back')}
            </Link>
          </div>
          <div className="grid grid-cols-1 divide-y divide-border/70 text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {(['intent', 'spec', 'continue'] as const).map((step) => (
              <div className="px-4 py-3" key={step}>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t(`workbench.steps.${step}.label`)}
                </p>
                <p className="mt-1 font-medium">{t(`workbench.steps.${step}.title`)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-card/80 p-4">
          <SimpleLoopIssueForm defaultTargetRepo={defaultTargetRepo} />
        </div>
      </div>
    </main>
  );
}
