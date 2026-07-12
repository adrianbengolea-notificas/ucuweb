'use client';

import Link from 'next/link';
import { ExternalLink, LogOut } from 'lucide-react';
import { logoutAdmin } from '@/components/admin/AdminAuth';
import { cn } from '@/lib/utils';

export function AdminMobileFooter({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn('space-y-1', collapsed && 'flex flex-col items-center')}>
      <Link
        href="/"
        target="_blank"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#1a5fb4]',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? 'Ver sitio' : undefined}
      >
        <ExternalLink className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && 'Ver sitio'}
      </Link>
      <button
        type="button"
        onClick={() => logoutAdmin()}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? 'Salir' : undefined}
      >
        <LogOut className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && 'Salir'}
      </button>
    </div>
  );
}
