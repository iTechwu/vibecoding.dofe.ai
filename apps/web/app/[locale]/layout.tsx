import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { Providers } from '@/providers';
import { IntlClientProvider } from '@/providers/intl-client-provider';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <IntlClientProvider
      locale={locale as Locale}
      messages={messages}
      enableMissingMessageLogging={process.env.NODE_ENV === 'development'}
    >
      <Providers>{children}</Providers>
    </IntlClientProvider>
  );
}
