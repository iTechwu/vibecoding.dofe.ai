'use client';

import { useEffect } from 'react';
import { Button } from '@repo/ui';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-background">
          <p className="text-destructive text-lg">页面发生错误</p>
          <Button variant="outline" onClick={reset} className="rounded-lg">
            重试
          </Button>
        </div>
      </body>
    </html>
  );
}
