'use client';

import { usePathname } from 'next/navigation';
import {
  AdminReclamoAlertBell,
  AdminReclamoAlertsProvider,
} from '@/components/admin/AdminReclamoAlerts';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { SidebarProvider, useSidebar } from '@/components/admin/AdminSidebarContext';
import { AdminUserBar } from '@/components/admin/AdminUserBar';
import { cn } from '@/lib/utils';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const wideContent = pathname.startsWith('/admin/reclamos');

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminSidebar />
      <AdminUserBar />
      <div
        className={cn(
          'min-h-screen pt-14 transition-[padding] duration-200 lg:pt-0',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-64'
        )}
      >
        <div className="pointer-events-none fixed right-4 top-3 z-40 hidden lg:block">
          <div className="pointer-events-auto">
            <AdminReclamoAlertBell className="bg-white shadow-sm ring-1 ring-slate-200" />
          </div>
        </div>
        <main
          className={cn(
            'mx-auto px-4 py-6 lg:px-8 lg:py-8 lg:pr-72',
            wideContent ? 'max-w-[1600px]' : 'max-w-6xl'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminReclamoAlertsProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </AdminReclamoAlertsProvider>
    </SidebarProvider>
  );
}
