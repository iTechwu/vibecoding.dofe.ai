'use client';

import type { ComponentType } from 'react';
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@repo/ui';
import {
  Bot,
  House,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useApp, useAuth } from '@/providers';

interface NavItem {
  titleKey: 'home' | 'issues' | 'review' | 'runtime';
  href: '/' | '/loops' | '/loops#review-inbox' | '/loops#agent-runtime';
  icon: ComponentType<{ className?: string }>;
  count?: number;
}

interface AppSidebarProps {
  reviewCount?: number;
}

function getInitials(nickname: string | null | undefined): string {
  return nickname?.charAt(0).toUpperCase() ?? '';
}

export function AppSidebar({ reviewCount = 0 }: AppSidebarProps) {
  const t = useTranslations('navigation');
  const pathname = usePathname() || '/';
  const { brandName } = useApp();
  const { user, logout } = useAuth();
  const initials = getInitials(user?.nickname);
  const items: NavItem[] = [
    { titleKey: 'home', href: '/', icon: House },
    { titleKey: 'issues', href: '/loops', icon: ListTodo },
    { titleKey: 'review', href: '/loops#review-inbox', icon: Inbox, count: reviewCount },
    { titleKey: 'runtime', href: '/loops#agent-runtime', icon: Bot },
  ];

  const isActive = (href: NavItem['href']) => {
    const [targetPath, fragment] = href.split('#');
    if (fragment) return false;

    return targetPath === '/'
      ? pathname === '/'
      : pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
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
                <Link href="/loops/new" aria-label={t('menu.newIssue')} title={t('menu.newIssue')}>
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
                      <Link href={item.href} aria-current={active ? 'page' : undefined}>
                        <item.icon />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.count && item.count > 0 ? (
                      <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                    ) : null}
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
            <SidebarMenuButton asChild tooltip={t('menu.settings')}>
              <Link href="/settings">
                <Settings />
                <span>{t('menu.settings')}</span>
              </Link>
            </SidebarMenuButton>
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
                  <Link href="/">
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
