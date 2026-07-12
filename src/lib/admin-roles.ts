import type { AdminPermission, AdminRole, ReclamosWriteScope } from '@/types/admin-users';

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  administrador: 'Administrador',
  editor: 'Editor',
  moderador: 'Moderador',
  operador: 'Operador',
};

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  administrador: 'Acceso total al panel, incluyendo gestión de usuarios.',
  editor: 'Gestiona notas, comentarios, delegaciones y acciones colectivas del sitio.',
  moderador: 'Gestiona fallos del observatorio.',
  operador: 'Gestiona reclamos. Por defecto solo edita casos asignados.',
};

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  administrador: [
    'posts:read',
    'posts:write',
    'comments:read',
    'comments:write',
    'acciones:read',
    'acciones:write',
    'delegaciones:read',
    'delegaciones:write',
    'fallos:read',
    'fallos:write',
    'reclamos:read',
    'reclamos:write',
    'users:read',
    'users:write',
  ],
  editor: [
    'posts:read',
    'posts:write',
    'comments:read',
    'comments:write',
    'acciones:read',
    'acciones:write',
    'delegaciones:read',
    'delegaciones:write',
  ],
  moderador: ['fallos:read', 'fallos:write'],
  operador: ['reclamos:read', 'reclamos:write'],
};

export function getPermissionsForRole(role: AdminRole): AdminPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  permissions: AdminPermission[],
  required: AdminPermission | AdminPermission[]
): boolean {
  const needed = Array.isArray(required) ? required : [required];
  return needed.every((perm) => permissions.includes(perm));
}

export function canAccessAdminPanel(role: AdminRole): boolean {
  return getPermissionsForRole(role).length > 0;
}

export function getReclamosWriteScopeForRole(
  role: AdminRole,
  scope?: ReclamosWriteScope
): ReclamosWriteScope {
  if (scope === 'all' || scope === 'assigned') return scope;
  return role === 'operador' ? 'assigned' : 'all';
}
