import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { buildDriveOAuthUrl } from '@/lib/drive-auth';

export async function GET(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const url = buildDriveOAuthUrl(session.email);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al iniciar OAuth';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
