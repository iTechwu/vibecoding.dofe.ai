'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@repo/ui';
import {
  Bot,
  ChevronLeft,
  Ellipsis,
  FolderKanban,
  FolderPlus,
  House,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import {
  useBrowseLoopWorkspaceDirectories,
  useCreateLoopWorkspaceFromDirectory,
  useLoopsWorkspaces,
} from '@/lib/api/contracts/hooks';
import { useApp, useAuth } from '@/providers';
import { getSelectedWorkspace, workspaceLabel } from '@/components/workbench/workspace-context';

interface NavItem {
  titleKey: 'home' | 'scheduled' | 'search';
  href: string;
  icon: typeof House;
}

function getInitials(nickname: string | null | undefined): string {
  return nickname?.charAt(0).toUpperCase() ?? '';
}

export function AppSidebar() {
  const t = useTranslations('navigation');
  const pathname = usePathname() || '/';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brandName } = useApp();
  const { user, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const workspacesQuery = useLoopsWorkspaces();
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false);
  const [directoryPath, setDirectoryPath] = useState('');
  const directoryQuery = useBrowseLoopWorkspaceDirectories(directoryPath, directoryPickerOpen);
  const createWorkspace = useCreateLoopWorkspaceFromDirectory();
  const initials = getInitials(user?.nickname);
  const workspaces = workspacesQuery.data?.body.data.workspaces ?? [];
  const selectedWorkspace = getSelectedWorkspace(
    workspaces,
    searchParams.get('workspace'),
    workspacesQuery.data?.body.data.current,
  );
  const items: NavItem[] = [
    { titleKey: 'home', href: '/', icon: House },
    { titleKey: 'scheduled', href: '/loops?view=scheduled', icon: ListTodo },
    { titleKey: 'search', href: '/loops?view=scheduled#scheduled-search', icon: Search },
  ];

  const isActive = (href: NavItem['href']) => {
    if (href === '/') return pathname === '/';
    if (href.includes('view=scheduled'))
      return pathname === '/loops' && searchParams.get('view') === 'scheduled';

    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };
  const browseResult = directoryQuery.data?.body.data;
  const browserPath = browseResult?.path ?? directoryPath;
  const parentDirectoryPath = browserPath.split('/').filter(Boolean).slice(0, -1).join('/');
  const selectCurrentDirectory = () => {
    createWorkspace.mutate(
      { body: { path: browserPath || '.', makeDefault: true } },
      {
        onSuccess: (result) => {
          const workspaceId = result.body.data.current;
          setDirectoryPickerOpen(false);
          closeMobileSidebar();
          router.push(`/loops?workspace=${encodeURIComponent(workspaceId)}`);
        },
      },
    );
  };

  return (
    <Sidebar className="bg-[#eef0e9]" collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <span className="px-2 text-sm font-semibold group-data-[collapsible=icon]:hidden">
          {brandName}
        </span>
        <span className="hidden px-2 text-sm font-semibold group-data-[collapsible=icon]:block">
          {brandName.charAt(0)}
        </span>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel>{t('groupMain')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 pb-2">
              <Button
                asChild
                className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              >
                <Link
                  href="/loops#loops-conversation-composer"
                  aria-label={t('menu.newIssue')}
                  onClick={closeMobileSidebar}
                  title={t('menu.newIssue')}
                >
                  <Plus className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{t('menu.newIssue')}</span>
                </Link>
              </Button>
            </div>
            <SidebarMenu className="px-2">
              {items.map((item) => {
                const title = t(`menu.${item.titleKey}`);
                const active = isActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={title}>
                      <Link
                        aria-current={active ? 'page' : undefined}
                        href={item.href}
                        onClick={closeMobileSidebar}
                      >
                        <item.icon />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-1">
            <span>{t('groupProjects')}</span>
            <Button
              aria-label={t('workspacePicker.open')}
              className="size-6 p-0"
              onClick={() => {
                setDirectoryPath('');
                setDirectoryPickerOpen(true);
              }}
              size="icon"
              title={t('workspacePicker.open')}
              variant="ghost"
            >
              <FolderPlus className="size-4" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2">
              {workspaces.map((workspace) => {
                const isSelected = workspace.workspaceId === selectedWorkspace?.workspaceId;
                const label = workspaceLabel(workspace);
                return (
                  <SidebarMenuItem key={workspace.workspaceId}>
                    <SidebarMenuButton asChild isActive={isSelected} tooltip={label}>
                      <Link
                        aria-current={isSelected ? 'page' : undefined}
                        href={`/loops?workspace=${encodeURIComponent(workspace.workspaceId)}`}
                        onClick={closeMobileSidebar}
                      >
                        <FolderKanban />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <Dialog open={directoryPickerOpen} onOpenChange={setDirectoryPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workspacePicker.title')}</DialogTitle>
            <DialogDescription>{t('workspacePicker.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex min-h-9 items-center gap-2 rounded-md border px-2 text-sm">
              <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate" title={browserPath || t('workspacePicker.root')}>
                {browserPath || t('workspacePicker.root')}
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border p-1">
              <Button
                aria-label={t('workspacePicker.up')}
                className="mb-1 w-full justify-start"
                disabled={!browserPath || directoryQuery.isLoading}
                onClick={() => setDirectoryPath(parentDirectoryPath)}
                size="sm"
                title={t('workspacePicker.up')}
                variant="ghost"
              >
                <ChevronLeft className="size-4" />
                <span>{t('workspacePicker.up')}</span>
              </Button>
              {directoryQuery.isLoading ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {t('workspacePicker.loading')}
                </p>
              ) : directoryQuery.isError ? (
                <div className="space-y-2 px-2 py-4">
                  <p className="text-sm text-destructive">{t('workspacePicker.unavailable')}</p>
                  <Button
                    className="w-full justify-start"
                    onClick={() => void directoryQuery.refetch()}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="size-4" />
                    <span>{t('workspacePicker.retry')}</span>
                  </Button>
                </div>
              ) : browseResult?.directories.length ? (
                browseResult.directories.map((directory) => (
                  <Button
                    className="w-full justify-start"
                    key={directory.path}
                    onClick={() => setDirectoryPath(directory.path)}
                    size="sm"
                    variant="ghost"
                  >
                    <FolderKanban className="size-4" />
                    <span className="truncate">{directory.name}</span>
                  </Button>
                ))
              ) : (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {t('workspacePicker.empty')}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDirectoryPickerOpen(false)} variant="outline">
              {t('workspacePicker.cancel')}
            </Button>
            <Button disabled={createWorkspace.isPending} onClick={selectCurrentDirectory}>
              {t('workspacePicker.choose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton aria-label={t('menu.more')} title={t('menu.more')}>
                  <Ellipsis />
                  <span>{t('menu.more')}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-52">
                <DropdownMenuLabel>{t('menu.more')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/loops?view=operations#review-inbox" onClick={closeMobileSidebar}>
                    <Inbox className="mr-2 size-4" />
                    {t('menu.review')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/loops?view=operations#agent-runtime" onClick={closeMobileSidebar}>
                    <Bot className="mr-2 size-4" />
                    {t('menu.runtime')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/loops?view=operations" onClick={closeMobileSidebar}>
                    <LayoutDashboard className="mr-2 size-4" />
                    {t('menu.dashboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={closeMobileSidebar}>
                    <Settings className="mr-2 size-4" />
                    {t('menu.settings')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton aria-label={t('menu.account')} title={t('menu.account')}>
                  <Avatar className="size-5">
                    <AvatarImage src={user?.headerImg || ''} alt="" />
                    <AvatarFallback>{initials || <User />}</AvatarFallback>
                  </Avatar>
                  <span>{user?.nickname || t('menu.account')}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuLabel>{user?.nickname || t('menu.account')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" onClick={closeMobileSidebar}>
                    <LayoutDashboard className="mr-2 size-4" />
                    {t('menu.dashboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={logout}>
                  <LogOut className="mr-2 size-4" />
                  {t('menu.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarTrigger className="self-end" />
      </SidebarFooter>
    </Sidebar>
  );
}
