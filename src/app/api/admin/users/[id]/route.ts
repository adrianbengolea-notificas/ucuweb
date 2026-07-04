import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { ADMIN_ROLE_LABELS } from '@/lib/admin-roles';
import { deleteAdminUser, upsertAdminUser } from '@/lib/admin-users-store';
import type { AdminRole, ReclamosWriteScope } from '@/types/admin-users';

const VALID_ROLES = Object.keys(ADMIN_ROLE_LABELS) as AdminRole[];

type RouteContext = { params: Promise<{ id: string }> };

function decodeEmail(id: string): string {
  return decodeURIComponent(id).trim().toLowerCase();
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'users:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const email = decodeEmail((await context.params).id);

  let body: {
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = body.role as AdminRole;
  const active = body.active !== false;
  const reclamosWriteScope =
    body.reclamosWriteScope === 'assigned' || body.reclamosWriteScope === 'all'
      ? body.reclamosWriteScope
      : undefined;
  const password = typeof body.password === 'string' ? body.password : undefined;

  if (!name) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  if (email === session.email && role !== 'administrador') {
    return NextResponse.json(
      { error: 'No podés quitarte el rol de administrador a vos mismo.' },
      { status: 400 }
    );
  }
  if (email === session.email && !active) {
    return NextResponse.json({ error: 'No podés desactivarte a vos mismo.' }, { status: 400 });
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'users:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const email = decodeEmail((await context.params).id);

  if (email === session.email) {
    return NextResponse.json({ error: 'No podés eliminarte a vos mismo.' }, { status: 400 });
  }

  try {
    await deleteAdminUser(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar usuario';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
