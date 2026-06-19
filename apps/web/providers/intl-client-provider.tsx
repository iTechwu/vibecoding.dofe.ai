'use client';

import type { ReactNode } from 'react';
import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider, IntlErrorCode } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { logger } from '@/lib/logger';

interface IntlClientProviderProps {
  locale: Locale;
  messages: AbstractIntlMessages;
  /** Set from server layout using NODE_ENV so the client bundle avoids env reads. */
  enableMissingMessageLogging?: boolean;
  children: ReactNode;
}

/**
 * Wraps next-intl client provider. When enableMissingMessageLogging is true,
 * logs missing message keys to the console to catch JSON drift early.
 */
export function IntlClientProvider({
  locale,
  messages,
  enableMissingMessageLogging = false,
  children,
}: IntlClientProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={
        enableMissingMessageLogging
          ? (error) => {
              if (error.code === IntlErrorCode.MISSING_MESSAGE) {
                logger.warn('[next-intl] Missing message:', error.message);
              }
            }
          : undefined
      }
    >
      {children}
    </NextIntlClientProvider>
  );
}
