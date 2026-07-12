import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import settingsMessages from '@/locales/en/settings.json';
import SettingsPage from './page';

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('@/components/layout', () => ({
  AppShell: ({ children }: React.PropsWithChildren) => (
    <div data-testid="app-shell">{children}</div>
  ),
  LocaleSwitcher: () => <button type="button">Switch language</button>,
}));

vi.mock('@/i18n/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/providers', () => ({
  useAuth: () => ({ user: { nickname: 'Ada', email: 'ada@example.com' } }),
}));

describe('SettingsPage', () => {
  it('renders authenticated account and language context without redirecting', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ settings: settingsMessages }}>
        <SettingsPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('en')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch language' })).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
