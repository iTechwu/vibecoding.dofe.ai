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
      <div className="flex h-screen flex-col w-full">
        {/* Full-width navbar at top */}
        <AppNavbar />

        {/* Sidebar and content below navbar */}
        <div className="flex flex-1 overflow-hidden [&_[data-slot=sidebar-container]]:top-14 [&_[data-slot=sidebar-container]]:h-[calc(100svh-3.5rem)] [&_[data-slot=sidebar-wrapper]]:min-h-0">
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
