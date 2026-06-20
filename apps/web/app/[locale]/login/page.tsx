'use client';

import { clearAll, getTokens, setLoginData } from '@/lib/storage';
import { checkSsoSession } from '@/lib/sso-session';
import { Button } from '@repo/ui';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

const LOCALES = ['zh-CN', 'en'] as const;

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const searchParams = useSearchParams();
  const locale = useLocale();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const validateCallbackUrl = useCallback((url: string): boolean => {
    if (!url.startsWith('/')) return false;
    if (url.startsWith('//')) return false;
    if (url.startsWith('/\\')) return false;
    if (/^(\/[^/]*):/.test(url)) return false;
    return true;
  }, []);

  const buildRedirectUrl = useCallback(
    (path: string): string => {
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;

      for (const loc of LOCALES) {
        const prefix = `/${loc}`;
        if (normalizedPath === prefix) {
          normalizedPath = '/';
          break;
        }
        if (normalizedPath.startsWith(`${prefix}/`)) {
          normalizedPath = normalizedPath.slice(prefix.length);
          break;
        }
      }

      if (locale === 'zh-CN') {
        return normalizedPath;
      }
      return `/${locale}${normalizedPath}`;
    },
    [locale],
  );

  const callbackUrl = useMemo(() => {
    const rawCallbackUrl = searchParams.get('callbackUrl') || '/';
    return validateCallbackUrl(rawCallbackUrl) ? rawCallbackUrl : '/';
  }, [searchParams, validateCallbackUrl]);

  const redirectToSso = useCallback(async () => {
    setError(null);
    window.location.replace(
      `/api/auth/oidc/authorize?redirect_uri=${encodeURIComponent(callbackUrl)}`,
    );
  }, [callbackUrl]);

  useEffect(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const tokens = getTokens();
    if (tokens) {
      router.replace(buildRedirectUrl(callbackUrl));
      return;
    }

    clearAll();

    (async () => {
      try {
        try {
          const directSession = await checkSsoSession();
          if (directSession) {
            setLoginData(directSession);
            router.replace(buildRedirectUrl(callbackUrl));
            return;
          }
        } catch (sessionError) {
          logger.warn('Direct SSO session check failed, trying iframe fallback', {
            error: sessionError instanceof Error ? sessionError.message : String(sessionError),
          });
        }

        await redirectToSso();
      } catch (err) {
        logger.warn('SSO login redirect failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        setError(t('redirectFailed'));
      }
    })();
  }, [buildRedirectUrl, callbackUrl, redirectToSso, router, t]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <AlertCircle className="size-10 text-destructive" />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-foreground">{t('redirectErrorTitle')}</h1>
              <p className="text-sm text-muted-foreground text-pretty">{error}</p>
            </div>
            <Button onClick={redirectToSso}>{t('retrySsoLogin')}</Button>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('redirectingToSso')}</p>
          </>
        )}
      </div>
    </div>
  );
}
