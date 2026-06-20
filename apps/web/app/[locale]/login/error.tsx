'use client';

import { useEffect } from 'react';
import { Button } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    logger.error('Login page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-background">
      <p className="text-destructive">{t('messages.loadFailed')}</p>
      <Button variant="outline" onClick={reset} className="rounded-lg">
        {t('actions.retry')}
      </Button>
    </div>
  );
}
