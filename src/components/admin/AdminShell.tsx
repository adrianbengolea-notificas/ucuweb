'use client';

import { usePathname } from 'next/navigation';
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
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </SidebarProvider>
  );
}
