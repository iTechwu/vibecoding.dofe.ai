import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import navigationMessages from '@/locales/en/navigation.json';
import { AppNavbar } from './app-navbar';

const mocks = vi.hoisted(() => ({ pathname: vi.fn(() => '/') }));

vi.mock('@repo/ui', () => ({
  Button: ({ children, asChild }: React.PropsWithChildren<{ asChild?: boolean }>) =>
    asChild ? <>{children}</> : <button type="button">{children}</button>,
  Separator: () => <div />,
  SidebarTrigger: () => <button type="button">Toggle Sidebar</button>,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }> & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: mocks.pathname,
}));

vi.mock('./locale-switcher', () => ({
  LocaleSwitcher: () => <button type="button">Switch language</button>,
}));

function renderNavbar() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ navigation: navigationMessages }}>
      <AppNavbar />
    </NextIntlClientProvider>,
  );
}

describe('AppNavbar', () => {
  it('shows the current destination and links search to the loop command input', () => {
    mocks.pathname.mockReturnValue('/loops/issue-1');
    renderNavbar();

    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open loop command' })).toHaveAttribute(
      'href',
      '/loops#loop-command-input',
    );
  });

  it('labels Home and Settings routes', () => {
    mocks.pathname.mockReturnValue('/');
    const { rerender } = renderNavbar();

    expect(screen.getByText('Home')).toBeInTheDocument();

    mocks.pathname.mockReturnValue('/settings');
    rerender(
      <NextIntlClientProvider locale="en" messages={{ navigation: navigationMessages }}>
        <AppNavbar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
