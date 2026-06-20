import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/config';

interface SettingsPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;

  redirect({ href: '/', locale });
}
