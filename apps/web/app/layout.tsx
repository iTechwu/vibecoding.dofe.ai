import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { BRAND_CONFIG } from '@/config';
import { defaultLocale, isValidLocale } from '@/i18n/config';

export const metadata: Metadata = {
  title: BRAND_CONFIG.title,
  description: BRAND_CONFIG.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localeHeader = (await headers()).get('x-next-intl-locale');
  const lang =
    localeHeader && isValidLocale(localeHeader) ? localeHeader : defaultLocale;

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
