export type AdminRole = 'administrador' | 'editor' | 'moderador' | 'operador';

/** Operadores con `assigned` solo editan reclamos donde son responsables. */
export type ReclamosWriteScope = 'all' | 'assigned';

export type AdminPermission =
  | 'posts:read'
  | 'posts:write'
  | 'comments:read'
  | 'comments:write'
  | 'fallos:read'
  | 'fallos:write'
  | 'reclamos:read'
  | 'reclamos:write'
  | 'users:read'
  | 'users:write';

export type AdminUser = {
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  reclamosWriteScope: ReclamosWriteScope;
  hasPassword: boolean;
  alternateEmails?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type AdminSessionUser = {
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  reclamosWriteScope: ReclamosWriteScope;
};

/** Credenciales internas (solo servidor). */
export type AdminUserAuthRecord = AdminUser & {
  passwordHash?: string;
  legacyPasswordHash?: string;
  legacyUsername?: string;
};
