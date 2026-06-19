'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { registerIntlNamespace } from '@/lib/i18n/runtime-translator';

/**
 * 向非 React 模块（如 ts-rest fetch、deprecation-warning）注册 errors / common 的翻译函数。
 */
export function RuntimeI18nBridge() {
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');

  useEffect(() => {
    registerIntlNamespace('errors', (key, values) =>
      values && Object.keys(values).length > 0
        ? tErrors(key, values)
        : tErrors(key),
    );
    registerIntlNamespace('common', (key, values) =>
      values && Object.keys(values).length > 0
        ? tCommon(key, values)
        : tCommon(key),
    );
    return () => {
      registerIntlNamespace('errors', null);
      registerIntlNamespace('common', null);
    };
  }, [tErrors, tCommon]);

  return null;
}
