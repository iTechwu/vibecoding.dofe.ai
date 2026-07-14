'use client';

import { SidebarInset, SidebarProvider } from '@repo/ui';
import { AppNavbar } from './app-navbar';
import { AppSidebar } from './app-sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div data-workbench className="flex h-dvh w-full flex-col bg-background text-foreground">
        <AppNavbar />
        <div className="flex min-h-0 flex-1 overflow-hidden [&_[data-slot=sidebar-container]]:top-13 [&_[data-slot=sidebar-container]]:h-[calc(100svh-3.25rem)] [&_[data-slot=sidebar-wrapper]]:min-h-0">
          <AppSidebar />
          <SidebarInset>
            <main className="flex h-full flex-1 flex-col overflow-hidden">
              <div className="h-full flex-1 overflow-auto">{children}</div>
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
