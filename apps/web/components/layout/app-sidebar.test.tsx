import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import navigationMessages from '@/locales/en/navigation.json';
import { AppSidebar } from './app-sidebar';

const mocks = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock('@repo/ui', () => {
  const Container = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const MenuItem = ({ children }: React.PropsWithChildren) => <li>{children}</li>;
  const MenuButton = ({
    children,
    asChild,
    ...props
  }: React.PropsWithChildren<{ asChild?: boolean }> &
    React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    );
  const Button = ({ children, asChild }: React.PropsWithChildren<{ asChild?: boolean }>) =>
    asChild ? <>{children}</> : <button type="button">{children}</button>;
  const DropdownItem = ({
    children,
    asChild,
    ...props
  }: React.PropsWithChildren<{ asChild?: boolean }> &
    React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    );

  return {
    Sidebar: Container,
    SidebarContent: Container,
    SidebarFooter: Container,
    SidebarGroup: Container,
    SidebarGroupContent: Container,
    SidebarGroupLabel: Container,
    SidebarHeader: Container,
    SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
    SidebarMenuBadge: Container,
    SidebarMenuButton: MenuButton,
    SidebarMenuItem: MenuItem,
    SidebarTrigger: Button,
    Avatar: Container,
    AvatarFallback: Container,
    AvatarImage: () => null,
    Button,
    DropdownMenu: Container,
    DropdownMenuContent: Container,
    DropdownMenuItem: DropdownItem,
    DropdownMenuLabel: Container,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuTrigger: Container,
  };
});

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
  usePathname: () => '/loops',
}));

vi.mock('@/providers', () => ({
  useApp: () => ({ brandName: 'Dofe' }),
  useAuth: () => ({
    user: { nickname: 'Ada', headerImg: '' },
    logout: mocks.logout,
  }),
}));

function renderSidebar() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ navigation: navigationMessages }}>
      <div>
        <AppSidebar />
      </div>
    </NextIntlClientProvider>,
  );
}

describe('AppSidebar', () => {
  it('renders task-first workbench destinations and footer controls', async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Issues' })).toHaveAttribute('href', '/loops');
    expect(screen.getByRole('link', { name: 'Issues' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/loops#review-inbox',
    );
    expect(screen.getByRole('link', { name: 'Runtime' })).toHaveAttribute(
      'href',
      '/loops#agent-runtime',
    );
    expect(screen.getByRole('link', { name: 'New Issue' })).toHaveAttribute('href', '/loops/new');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
});
