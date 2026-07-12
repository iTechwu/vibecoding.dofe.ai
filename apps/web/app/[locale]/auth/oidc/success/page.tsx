'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { setTokens, setIdToken, setUser } from '@/lib/storage';
import { AlertCircle, Loader2 } from 'lucide-react';
import { oidcAuthClient } from '@/lib/api/contracts/client';
import {
  ACCESS_TOKEN_DEFAULT_EXPIRY_S,
  REFRESH_TOKEN_DEFAULT_EXPIRY_MS,
} from '@dofe/sso-contracts/token';

/**
 * OIDC Callback Page
 *
 * [SSO-LOGIN-REDESIGN] i18n 已实现 ✅
 * SSO 回调完成后由后端 302 重定向至此页面，URL 中包含一次性授权码 (code)
 * 或 error/error_description（用户拒绝授权等场景）。
 *
 * 流程：后端 handleCallback → Redis 存储令牌 → 302 重定向此页（仅含 code）
 *       → 前端 POST /auth/oidc/exchange 交换令牌 → 存储 → 跳转目标页
 *
 * 使用 window.location.href 全量跳转以确保 useAuth 上下文重新初始化。
 */
export default function OidcCallbackPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations('auth.oidc.success');
  const processed = useRef(false);
  const [exchangeFailed, setExchangeFailed] = useState(false);
  // Keep the initial OAuth error after replaceState removes sensitive query data.
  const [callbackError] = useState(() => searchParams.get('error'));
  const error = exchangeFailed ? 'exchange_failed' : callbackError;
  const errorDescription = error ? t('errorDescription') : undefined;

  const getLocalePrefix = (currentPathname: string) => {
    const match = currentPathname.match(/^\/(zh-CN|en)/);
    return match ? match[0] : '';
  };

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const localePrefix = getLocalePrefix(pathname);

    if (callbackError) {
      // Clean URL for error case too
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const authCode = searchParams.get('code');

    if (!authCode) {
      window.location.href = `${localePrefix}/login`;
      return;
    }

    // Clean code from URL immediately
    window.history.replaceState(null, '', window.location.pathname);

    // Exchange one-time auth code for tokens (tokens never appear in URL)
    (async () => {
      try {
        const response = await oidcAuthClient.exchangeCode({
          body: { code: authCode },
        });

        if (response.status !== 200) {
          throw new Error('Exchange request failed');
        }

        const body = response.body as Record<string, unknown>;
        const data = body?.data as Record<string, unknown> | undefined;

        if (!data?.access_token) {
          throw new Error('No access token in exchange response');
        }

        const now = Date.now();
        const expiresInS = (data.expires_in as number) ?? ACCESS_TOKEN_DEFAULT_EXPIRY_S;

        setTokens({
          access: data.access_token as string,
          accessExpire: (data.access_expire as number) ?? now + expiresInS * 1000,
          expire: (data.expire as number) ?? now + REFRESH_TOKEN_DEFAULT_EXPIRY_MS,
        });

        if (data.id_token) {
          setIdToken(data.id_token as string);
        }

        // Store user info from exchange response (avoids extra API call)
        if (data.user && typeof data.user === 'object') {
          setUser(data.user as Parameters<typeof setUser>[0]);
        }

        const redirectUri = searchParams.get('redirect_uri');
        let redirectTarget =
          redirectUri?.startsWith('/') &&
          !redirectUri.startsWith('//') &&
          !redirectUri.startsWith('/\\') &&
          !/^(\/[^/]*):/.test(redirectUri)
            ? redirectUri
            : '/';

        const targetLocalePrefix = redirectTarget.match(/^\/(zh-CN|en)(?=\/|$)/)?.[0];
        if (targetLocalePrefix) {
          redirectTarget = redirectTarget.slice(targetLocalePrefix.length) || '/';
        }

        window.location.href = `${localePrefix}${redirectTarget}`;
      } catch {
        setExchangeFailed(true);
      }
    })();
  }, [callbackError, pathname, searchParams]);

  // Error state
  if (error) {
    const localePrefix = getLocalePrefix(pathname);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">{t('errorTitle')}</h2>
          <p className="text-muted-foreground text-sm">{errorDescription || error}</p>
          <a
            href={`${localePrefix}/login`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('backToLogin')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      </div>
    </div>
  );
}
