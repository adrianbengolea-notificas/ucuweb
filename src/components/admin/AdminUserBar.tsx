'use client';

import Link from 'next/link';
import { ExternalLink, LogOut, Shield } from 'lucide-react';
import { logoutAdmin, useAdminUser } from '@/components/admin/AdminAuth';
import { ADMIN_ROLE_LABELS } from '@/lib/admin-roles';

export function AdminUserBar() {
  const user = useAdminUser();

  return (
    <div className="fixed right-0 top-0 z-40 hidden w-64 border-b border-l border-slate-200 bg-white lg:block">
      <div className="p-3">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a5fb4]/10 text-xs font-bold text-[#1a5fb4]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-[#2d8f47]" />
            <span className="text-xs font-medium text-[#2d8f47]">{ADMIN_ROLE_LABELS[user.role]}</span>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#1a5fb4]"
          >
            <ExternalLink className="h-[18px] w-[18px] shrink-0" />
            Ver sitio
          </Link>
          <button
            type="button"
            onClick={() => logoutAdmin()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
