import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import navigationMessages from '@/locales/en/navigation.json';
import { AppSidebar } from './app-sidebar';

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  setOpenMobile: vi.fn(),
  push: vi.fn(),
  createWorkspace: vi.fn(),
  refetchDirectories: vi.fn(),
  directoryBrowserError: false,
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
  const Button = ({
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
    Dialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DialogContent: Container,
    DialogDescription: Container,
    DialogFooter: Container,
    DialogHeader: Container,
    DialogTitle: Container,
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

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mocks.push }),
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
  useBrowseLoopWorkspaceDirectories: (path: string) => ({
    data: {
      body: {
        data: {
          path,
          directories:
            path === 'dofe'
              ? [{ name: 'vibecoding', path: 'dofe/vibecoding' }]
              : [{ name: 'dofe', path: 'dofe' }],
        },
      },
    },
    isLoading: false,
    isError: mocks.directoryBrowserError,
    refetch: mocks.refetchDirectories,
  }),
  useCreateLoopWorkspaceFromDirectory: () => ({
    mutate: mocks.createWorkspace,
    isPending: false,
  }),
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

  it('creates a workspace by selecting a server-browsed local folder', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Choose local folder' }));
    expect(screen.getByText('dofe')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'dofe' }));
    await user.click(screen.getByRole('button', { name: 'vibecoding' }));
    await user.click(screen.getByRole('button', { name: 'Use this folder' }));

    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      { body: { path: 'dofe/vibecoding', makeDefault: true } },
      expect.any(Object),
    );
  });

  it('retries only the folder browser when the directory query fails', async () => {
    const user = userEvent.setup();
    mocks.directoryBrowserError = true;
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Choose local folder' }));
    await user.click(screen.getByRole('button', { name: 'Retry folder list' }));

    expect(mocks.refetchDirectories).toHaveBeenCalledOnce();
    mocks.directoryBrowserError = false;
  });
});
