'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gavel,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  Users,
  ClipboardList,
  Megaphone,
  Tags,
  UserCheck,
  X,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { useAdminUser } from '@/components/admin/AdminAuth';
import { AdminMobileFooter } from '@/components/admin/AdminMobileFooter';
import { useSidebar } from '@/components/admin/AdminSidebarContext';
import { cn } from '@/lib/utils';
import type { AdminPermission } from '@/types/admin-users';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: AdminPermission;
  exact?: boolean;
  accent?: 'green' | 'blue';
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Contenido',
    items: [
      { href: '/admin', label: 'Notas', icon: LayoutDashboard, permission: 'posts:read', exact: true },
      { href: '/admin/posts/nueva', label: 'Nueva nota', icon: Plus, permission: 'posts:write', accent: 'green' },
      { href: '/admin/comentarios', label: 'Comentarios', icon: MessageSquare, permission: 'comments:read' },
      {
        href: '/admin/acciones-colectivas',
        label: 'Acciones colectivas',
        icon: Megaphone,
        permission: 'acciones:read',
      },
      {
        href: '/admin/delegaciones',
        label: 'Delegaciones',
        icon: UserCheck,
        permission: 'delegaciones:read',
      },
    ],
  },
  {
    title: 'Observatorio',
    items: [
      { href: '/admin/fallos', label: 'Fallos', icon: Gavel, permission: 'fallos:read' },
      {
        href: '/admin/fallos/buscar',
        label: 'Buscar fallos (IA)',
        icon: Search,
        permission: 'fallos:read',
        exact: true,
      },
      { href: '/admin/fallos/nuevo', label: 'Nuevo fallo', icon: Plus, permission: 'fallos:write', accent: 'blue' },
    ],
  },
  {
    title: 'Reclamos',
    items: [
      {
        href: '/admin/reclamos',
        label: 'Reclamos',
        icon: ClipboardList,
        permission: 'reclamos:read',
        exact: true,
      },
      {
        href: '/admin/reclamos/asignados',
        label: 'Asignados',
        icon: UserCheck,
        permission: 'reclamos:read',
        exact: true,
      },
      {
        href: '/admin/reclamos/causas',
        label: 'Causas de reclamos',
        icon: Tags,
        permission: 'reclamos:read',
        exact: true,
      },
      {
        href: '/admin/reclamos/contestacion-oficios',
        label: 'Contestación de oficios',
        icon: FileText,
        permission: 'reclamos:read',
        exact: true,
      },
      {
        href: '/admin/reclamos/estadisticas',
        label: 'Estadísticas',
        icon: BarChart3,
        permission: 'reclamos:read',
        exact: true,
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/admin/usuarios', label: 'Usuarios', icon: Users, permission: 'users:read' },
      { href: '/admin/perfil', label: 'Mi perfil', icon: UserCheck, exact: true },
    ],
  },
];

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const accentClass =
    item.accent === 'green'
      ? 'text-[#2d8f47] hover:bg-green-50 hover:text-[#1f6b31]'
      : item.accent === 'blue'
        ? 'text-[#1a5fb4] hover:bg-blue-50 hover:text-[#134a8a]'
        : '';

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-[#1a5fb4] text-white shadow-sm'
          : accentClass || 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          isActive ? 'text-white' : item.accent === 'green' ? 'text-[#2d8f47]' : 'text-slate-400 group-hover:text-current'
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const user = useAdminUser();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permission || user.permissions.includes(item.permission)
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      <div className={cn('flex items-center border-b border-slate-200 px-4 py-5', collapsed && 'justify-center px-2')}>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <Link href="/admin" className="block truncate text-lg font-bold text-[#1a5fb4]" onClick={onNavigate}>
              UCU Admin
            </Link>
            <p className="mt-0.5 truncate text-xs text-slate-400">Panel de gestión</p>
          </div>
        ) : (
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a5fb4] text-sm font-bold text-white"
            onClick={onNavigate}
          >
            U
          </Link>
        )}
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-2 hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:block"
            aria-label="Colapsar menú"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 lg:hidden">
        <AdminMobileFooter collapsed={collapsed} />
      </div>

      {onToggleCollapse && collapsed && (
        <div className="hidden border-t border-slate-200 p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Expandir menú"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

export function AdminSidebar() {
  const { collapsed, setCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/admin" className="text-lg font-bold text-[#1a5fb4]">
          UCU Admin
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      </aside>
    </>
  );
}
