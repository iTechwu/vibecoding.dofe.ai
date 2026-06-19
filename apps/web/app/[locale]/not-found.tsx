'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@repo/ui';
import { Home, LayoutDashboard } from 'lucide-react';
import { BRAND_CONFIG } from '@/config';
import { DecorativeGlow } from '@/components/ui/decorative';

export default function NotFound() {
  const t = useTranslations('common.notFound');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <DecorativeGlow position="top-left" size="lg" />
      <DecorativeGlow position="bottom-right" size="lg" />

      <div className="relative z-10 text-center px-6 max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image
            src={BRAND_CONFIG.logo}
            alt={BRAND_CONFIG.name}
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="text-xl font-bold text-foreground tracking-tight">
            {BRAND_CONFIG.name}
          </span>
        </div>

        <h1 className="text-8xl font-bold text-primary/20 mb-4 select-none">
          404
        </h1>
        <h2 className="text-2xl font-bold text-foreground mb-3">{t('title')}</h2>
        <p className="text-muted-foreground/60 mb-8">{t('description')}</p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button variant="outline">
              <Home className="size-4 mr-2" />
              {t('goHome')}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button>
              <LayoutDashboard className="size-4 mr-2" />
              {t('goDashboard')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
