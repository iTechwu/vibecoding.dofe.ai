'use client';

import { Button, Separator, SidebarTrigger } from '@repo/ui';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';

export function AppNavbar() {
  const t = useTranslations('navigation.menu');
  const pathname = usePathname() || '/';
  const destination = pathname.startsWith('/settings')
    ? t('settings')
    : pathname.startsWith('/loops')
      ? t('issues')
      : t('home');

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden -ml-2" />
        <span className="text-sm font-medium">{destination}</span>
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
      </div>
    </header>
  );
}
