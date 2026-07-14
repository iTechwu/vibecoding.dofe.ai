'use client';

import { AppShell, LocaleSwitcher } from '@/components/layout';
import { localeNames, type Locale } from '@/i18n/config';
import { useAuth } from '@/providers';
import { useLoopsWorkspaces } from '@/lib/api/contracts/hooks';
import { useLocale, useTranslations } from 'next-intl';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { user } = useAuth();
  const workspacesQuery = useLoopsWorkspaces();
  const workspaces = workspacesQuery.data?.body.data.workspaces ?? [];
  const currentWorkspaceId = workspacesQuery.data?.body.data.current;
  const currentWorkspace =
    workspaces.find((workspace) => workspace.workspaceId === currentWorkspaceId) ?? workspaces[0];

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </header>

        <dl className="divide-y divide-border">
          <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-muted-foreground">{t('account')}</dt>
            <dd className="text-sm sm:col-span-2">{user?.nickname || t('notAvailable')}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-muted-foreground">{t('email')}</dt>
            <dd className="text-sm sm:col-span-2">{user?.email || t('notAvailable')}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-muted-foreground">{t('workspace')}</dt>
            <dd className="break-all text-sm sm:col-span-2">
              {currentWorkspace?.root || t('workspaceUnavailable')}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <dt className="text-sm text-muted-foreground">{t('language')}</dt>
              <dd className="text-sm">{localeNames[locale as Locale] ?? locale}</dd>
            </div>
            <LocaleSwitcher />
          </div>
        </dl>
      </section>
    </AppShell>
  );
}
