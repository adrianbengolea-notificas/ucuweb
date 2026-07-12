'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAdminUser } from '@/components/admin/AdminAuth';
import type { AdminPermission } from '@/types/admin-users';

const FALLBACK_ROUTES: { permission: AdminPermission; href: string }[] = [
  { permission: 'posts:read', href: '/admin' },
  { permission: 'acciones:read', href: '/admin/acciones-colectivas' },
  { permission: 'delegaciones:read', href: '/admin/delegaciones' },
  { permission: 'comments:read', href: '/admin/comentarios' },
  { permission: 'fallos:read', href: '/admin/fallos' },
  { permission: 'reclamos:read', href: '/admin/reclamos' },
  { permission: 'users:read', href: '/admin/usuarios' },
];

export function RequirePermission({
  permission,
  children,
}: {
  permission: AdminPermission | AdminPermission[];
  children: React.ReactNode;
}) {
  const user = useAdminUser();
  const router = useRouter();
  const needed = Array.isArray(permission) ? permission : [permission];
  const allowed = needed.some((perm) => user.permissions.includes(perm));

  useEffect(() => {
    if (!allowed) {
      const fallback = FALLBACK_ROUTES.find((route) =>
        user.permissions.includes(route.permission)
      );
      router.replace(fallback?.href ?? '/admin/login');
    }
  }, [allowed, router, user.permissions]);

  if (!allowed) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
      </div>
    );
  }

  return <>{children}</>;
}

export function useDefaultAdminRoute(): string {
  const user = useAdminUser();
  return (
    FALLBACK_ROUTES.find((route) => user.permissions.includes(route.permission))?.href ??
    '/admin/login'
  );
}
