'use client';

import { Button, Separator, SidebarTrigger } from '@repo/ui';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useApp, useAuth } from '@/providers';
import { LocaleSwitcher } from './locale-switcher';

export function AppNavbar() {
  const t = useTranslations('navigation.menu');
  const navigation = useTranslations('navigation');
  const pathname = usePathname() || '/';
  const { brandName } = useApp();
  const { user } = useAuth();
  const destination = pathname.startsWith('/settings')
    ? t('settings')
    : pathname.startsWith('/loops')
      ? t('workspace')
      : t('home');

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden -ml-2" />
        <span className="text-sm font-medium">{destination}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {navigation('team', { team: brandName })}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link
            href="/loops#loop-command-input"
            aria-label={t('commandSearch')}
            title={t('commandSearch')}
          >
            <Search className="size-4" />
            <span className="sr-only">{t('commandSearch')}</span>
          </Link>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <LocaleSwitcher />
        <span className="ml-1 hidden max-w-28 truncate text-xs text-muted-foreground sm:inline">
          {user?.nickname || t('account')}
        </span>
      </div>
    </header>
  );
}
