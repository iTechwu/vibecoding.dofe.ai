'use client';

import { Button, Separator, SidebarTrigger } from '@repo/ui';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './locale-switcher';

export function AppNavbar() {
  const t = useTranslations('navigation.menu');

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden -ml-2" />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-8">
          <Search className="size-4" />
          <span className="sr-only">{t('search')}</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
