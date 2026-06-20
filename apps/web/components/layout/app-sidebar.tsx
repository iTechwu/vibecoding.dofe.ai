'use client';

import { useMemo, useCallback, memo } from 'react';
import type { ComponentType } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@repo/ui';
import { cn } from '@repo/ui/lib/utils';
import { LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useApp, useIsAdmin } from '@/providers';

interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

interface NavItem {
  titleKey?: string;
  title?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

/**
 * Navigation configuration for sidebar
 * Customize this for your application
 */
const navGroups: NavGroup[] = [
  {
    groupKey: 'main',
    items: [
      {
        titleKey: 'dashboard',
        href: '/',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    groupKey: 'settings',
    items: [
      {
        titleKey: 'settings',
        href: '/settings',
        icon: Settings,
      },
    ],
  },
];

// Memoized nav item component
const NavItemComponent = memo(function NavItemComponent({
  item,
  isActive,
  title,
}: {
  item: NavItem;
  isActive: boolean;
  title: string;
}) {
  return (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={title}
        className={cn(
          'relative h-9 rounded-md transition-all duration-150',
          isActive ? ['bg-primary/20', 'font-medium', 'shadow-sm'] : ['hover:bg-accent'],
        )}
      >
        <Link
          href={item.href}
          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
        >
          <item.icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : '')} />
          <span className="truncate group-data-[collapsible=icon]:hidden">{title}</span>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

export function AppSidebar() {
  const t = useTranslations('navigation.menu');
  const pathname = usePathname();
  const { brandName, brandLogo } = useApp();
  const isAdmin = useIsAdmin();

  const currentPath = useMemo(() => pathname || '/', [pathname]);

  // Memoize filtered groups based on admin permission
  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.adminOnly || isAdmin),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin]);

  // Memoize title getter
  const getItemTitle = useCallback(
    (item: NavItem) => item.title || (item.titleKey ? t(item.titleKey) : ''),
    [t],
  );

  // Memoize active state checker
  const isItemActive = useCallback(
    (href: string) => currentPath === href || currentPath.startsWith(`${href}/`),
    [currentPath],
  );

  // Render a navigation group
  const renderNavGroup = useCallback(
    (group: NavGroup & { items: NavItem[] }) => (
      <SidebarGroup key={group.groupKey}>
        <SidebarGroupLabel className="uppercase tracking-widest text-[10px] font-medium px-3 mb-1">
          {t(
            `group${group.groupKey.charAt(0).toUpperCase()}${group.groupKey.slice(1)}` as Parameters<
              typeof t
            >[0],
          )}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1 px-2">
            {group.items.map((item) => (
              <NavItemComponent
                key={item.href}
                item={item}
                isActive={isItemActive(item.href)}
                title={getItemTitle(item)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ),
    [t, isItemActive, getItemTitle],
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarContent className="pt-4">{filteredGroups.map(renderNavGroup)}</SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 relative">
        <div className="p-3">
          <div className="flex items-center">
            {/* Expanded state: show logo + brand name */}
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <span className="font-semibold truncate">{brandName}</span>
            </div>

            {/* Collapsed state: only show brand name initial */}
            <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
              <span className="font-semibold">{brandName.charAt(0)}</span>
            </div>
          </div>
        </div>

        {/* Collapse/expand button, fixed at bottom right */}
        <div className="absolute -right-3" style={{ bottom: 'calc(0.75rem + 50px)' }}>
          <SidebarTrigger className="size-8 bg-accent" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
