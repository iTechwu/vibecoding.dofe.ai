import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import navigationMessages from '@/locales/en/navigation.json';
import { AppSidebar } from './app-sidebar';

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  setOpenMobile: vi.fn(),
  upsertWorkspace: vi.fn(),
  push: vi.fn(),
}));

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
    useSidebar: () => ({ isMobile: true, setOpenMobile: mocks.setOpenMobile }),
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
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/contracts/hooks', () => ({
  useLoopsWorkspaces: () => ({
    data: {
      body: {
        data: {
          current: 'web',
          workspaces: [
            {
              workspaceId: 'web',
              root: '/code/storefront',
              status: 'READY',
              isDefault: true,
              selected: { codex: 'local-cli', 'claude-code': 'local-cli' },
            },
            {
              workspaceId: 'api',
              root: '/code/api-service',
              status: 'SELECTED',
              isDefault: false,
              selected: { codex: 'docker', 'claude-code': 'local-cli' },
            },
          ],
        },
      },
    },
  }),
  useUpsertLoopsWorkspace: () => ({ isPending: false, mutateAsync: mocks.upsertWorkspace }),
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
  it('creates a project workspace and selects it after submission', async () => {
    const user = userEvent.setup();
    mocks.upsertWorkspace.mockResolvedValueOnce({ body: { data: {} } });
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project ID'), 'checkout');
    await user.type(screen.getByLabelText('Project path'), '/code/checkout');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(mocks.upsertWorkspace).toHaveBeenCalledWith({
      body: { workspaceId: 'checkout', root: '/code/checkout', makeDefault: true },
    });
    expect(mocks.push).toHaveBeenCalledWith('/loops?workspace=checkout');
  });

  it('renders workspace-first destinations and footer controls', async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText('Workspaces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Scheduled' })).toHaveAttribute(
      'href',
      '/loops?view=scheduled',
    );
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/loops?view=scheduled#scheduled-search',
    );
    expect(screen.getByRole('link', { name: 'storefront' })).toHaveAttribute(
      'href',
      '/loops?workspace=web',
    );
    expect(screen.getByRole('link', { name: 'storefront' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'api-service' })).toHaveAttribute(
      'href',
      '/loops?workspace=api',
    );
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/loops?view=operations#review-inbox',
    );
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Runtime' })).toHaveAttribute(
      'href',
      '/loops?view=operations#agent-runtime',
    );
    expect(screen.getByRole('link', { name: 'New work' })).toHaveAttribute(
      'href',
      '/loops#loops-conversation-composer',
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Scheduled' }));
    expect(mocks.setOpenMobile).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
});
