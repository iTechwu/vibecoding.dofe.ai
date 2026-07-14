'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
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
  Ellipsis,
  FolderKanban,
  House,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useLoopsWorkspaces, useUpsertLoopsWorkspace } from '@/lib/api/contracts/hooks';
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
  const upsertWorkspace = useUpsertLoopsWorkspace();
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [projectRoot, setProjectRoot] = useState('');
  const [projectError, setProjectError] = useState<string>();
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
  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workspaceId = projectId.trim();
    const root = projectRoot.trim();
    if (!workspaceId || !root) {
      setProjectError(t('project.required'));
      return;
    }
    setProjectError(undefined);
    try {
      await upsertWorkspace.mutateAsync({ body: { workspaceId, root, makeDefault: true } });
      setCreatingProject(false);
      setProjectId('');
      setProjectRoot('');
      closeMobileSidebar();
      router.push(`/loops?workspace=${encodeURIComponent(workspaceId)}`);
    } catch {
      setProjectError(t('project.createError'));
    }
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
          <div className="flex items-center justify-between px-2">
            <SidebarGroupLabel>{t('groupProjects')}</SidebarGroupLabel>
            <button
              aria-label={t('project.new')}
              className="size-7 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={() => setCreatingProject((open) => !open)}
              type="button"
            >
              <Plus aria-hidden="true" className="mx-auto size-4" />
            </button>
          </div>
          <SidebarGroupContent>
            {creatingProject ? (
              <form className="space-y-2 px-2 pb-2" onSubmit={(event) => void createProject(event)}>
                <label className="block text-xs font-medium" htmlFor="project-workspace-id">
                  {t('project.id')}
                </label>
                <input
                  className="h-8 w-full border border-input bg-background px-2 text-sm"
                  id="project-workspace-id"
                  onChange={(event) => setProjectId(event.target.value)}
                  value={projectId}
                />
                <label className="block text-xs font-medium" htmlFor="project-root">
                  {t('project.root')}
                </label>
                <input
                  className="h-8 w-full border border-input bg-background px-2 text-sm"
                  id="project-root"
                  onChange={(event) => setProjectRoot(event.target.value)}
                  value={projectRoot}
                />
                {projectError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {projectError}
                  </p>
                ) : null}
                <button
                  className="h-8 w-full bg-foreground px-2 text-sm font-medium text-background disabled:opacity-60"
                  disabled={upsertWorkspace.isPending}
                  type="submit"
                >
                  {t('project.create')}
                </button>
              </form>
            ) : null}
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
