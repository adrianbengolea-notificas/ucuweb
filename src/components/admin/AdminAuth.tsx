'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { AdminPermission, AdminRole, ReclamosWriteScope } from '@/types/admin-users';

export type AdminUserContext = {
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  reclamosWriteScope: ReclamosWriteScope;
};

const AdminUserCtx = createContext<AdminUserContext | null>(null);

export function useAdminUser(): AdminUserContext {
  const ctx = useContext(AdminUserCtx);
  if (!ctx) throw new Error('useAdminUser debe usarse dentro de AdminAuth');
  return ctx;
}

export function AdminAuth({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUserContext | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/me', { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 503) {
          setConfigError(
            'Falta configurar ADMIN_PANEL_EMAIL y ADMIN_SESSION_SECRET en .env.local.'
          );
          return;
        }
        if (!res.ok) {
          router.push('/admin/login');
          return;
        }
        const data = await res.json();
        setUser({
          email: data.email,
          name: data.name,
          role: data.role,
          permissions: data.permissions ?? [],
          reclamosWriteScope: data.reclamosWriteScope === 'assigned' ? 'assigned' : 'all',
        });
      })
      .catch(() => {
        if (!cancelled) router.push('/admin/login');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user && !configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#1a5fb4]" />
          <p className="text-slate-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="max-w-md text-center text-slate-700">{configError}</p>
      </div>
    );
  }

  if (!user) return null;

  return <AdminUserCtx.Provider value={user}>{children}</AdminUserCtx.Provider>;
}

export async function logoutAdmin() {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore */
  }
  window.location.href = '/admin/login';
}
