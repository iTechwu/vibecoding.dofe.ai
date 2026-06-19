'use client';

import { AppShell } from '@/components/layout';
import { useTranslations } from 'next-intl';

export default function LocalePage() {
  const t = useTranslations('home');
  const tc = useTranslations('home.cards');

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-4">{t('hero.title')}</h1>
        <p className="text-lg mb-8 text-muted-foreground">
          {t('hero.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">
              {tc('documentation.title')}
            </h2>
            <p className="text-muted-foreground">
              {tc('documentation.description')}
            </p>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">
              {tc('quickStart.title')}
            </h2>
            <p className="text-muted-foreground">
              {tc('quickStart.lineBefore')}{' '}
              <code className="bg-muted px-2 py-1 rounded text-sm">
                pnpm dev
              </code>{' '}
              {tc('quickStart.lineAfter')}
            </p>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">
              {tc('architecture.title')}
            </h2>
            <p className="text-muted-foreground">
              {tc('architecture.description')}
            </p>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">{tc('agents.title')}</h2>
            <p className="text-muted-foreground">{tc('agents.description')}</p>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">
              {tc('sharedPackages.title')}
            </h2>
            <p className="text-muted-foreground">
              {tc('sharedPackages.description')}
            </p>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">
              {tc('typeSafety.title')}
            </h2>
            <p className="text-muted-foreground">
              {tc('typeSafety.description')}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
