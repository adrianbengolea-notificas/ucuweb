import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { ADMIN_ROLE_LABELS } from '@/lib/admin-roles';
import { deleteAdminUser, listAdminUsers, upsertAdminUser } from '@/lib/admin-users-store';
import type { AdminRole, ReclamosWriteScope } from '@/types/admin-users';

const VALID_ROLES = Object.keys(ADMIN_ROLE_LABELS) as AdminRole[];

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'users:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = requireAdminPermission(request, 'users:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let body: {
    email?: string;
    name?: string;
    role?: string;
    active?: boolean;
    reclamosWriteScope?: string;
    password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = body.role as AdminRole;
  const active = body.active !== false;
  const reclamosWriteScope =
    body.reclamosWriteScope === 'assigned' || body.reclamosWriteScope === 'all'
      ? body.reclamosWriteScope
      : undefined;
  const password = typeof body.password === 'string' ? body.password : undefined;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  try {
    const user = await upsertAdminUser({
      email,
      name,
      role,
      active,
      reclamosWriteScope,
      password,
      createdBy: session.email,
    });
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al guardar usuario';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
