'use client';

import { ClientOnly } from '@/components/client-only';
import { useAuth } from '@/providers';
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
  Separator,
  SidebarTrigger,
} from '@repo/ui';
import { LayoutDashboard, LogOut, Search, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';

/**
 * Get initials from nickname
 * Returns first character of nickname (uppercase)
 */
function getInitials(nickname: string | null | undefined): string {
  if (!nickname) return '';
  return nickname.charAt(0).toUpperCase();
}

export function AppNavbar() {
  const t = useTranslations('navigation.menu');
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const initials = getInitials(user?.nickname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        {/* Mobile sidebar trigger - only visible on mobile */}
        <SidebarTrigger className="md:hidden -ml-2" />
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-8">
          <Search className="size-4" />
          <span className="sr-only">{t('search')}</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <LocaleSwitcher />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ClientOnly
          fallback={
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          }
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-full">
                <Avatar className="size-8">
                  <AvatarImage src={user?.headerImg || ''} alt={user?.nickname || 'User'} />
                  <AvatarFallback className="text-xs">
                    {initials || <User className="size-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{user?.nickname || t('account')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">
                  <LayoutDashboard className="mr-2 size-4" />
                  {t('dashboard')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ClientOnly>
      </div>
    </header>
  );
}
