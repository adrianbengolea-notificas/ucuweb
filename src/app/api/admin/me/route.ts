import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionConfig,
  requireAdminSession,
  verifyAdminSessionToken,
} from '@/lib/admin-session';
import { getPermissionsForRole } from '@/lib/admin-roles';
import { resolveAdminSessionUser } from '@/lib/admin-users-store';

export async function GET(request: NextRequest) {
  const cfg = getAdminSessionConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }

  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const tokenSession = raw ? verifyAdminSessionToken(raw, cfg.secret) : null;
  if (!tokenSession) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await resolveAdminSessionUser(tokenSession.email);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    reclamosWriteScope: user.reclamosWriteScope,
  });
}

export async function PATCH(request: NextRequest) {
  const session = requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : session.name;
  if (!name) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    email: session.email,
    name,
    role: session.role,
    permissions: getPermissionsForRole(session.role),
  });
}
