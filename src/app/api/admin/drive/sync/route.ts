import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { syncReclamoConDrive } from '@/lib/drive-sync';

/** Trigger manual de sync para un reclamo específico. También puede ser llamado por Cloud Scheduler. */
export async function POST(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:write');
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = (await request.json()) as { reclamoId?: number };
  const reclamoId = Number(body.reclamoId);
  if (!Number.isFinite(reclamoId)) {
    return NextResponse.json({ error: 'reclamoId inválido' }, { status: 400 });
  }

  try {
    const resultado = await syncReclamoConDrive(reclamoId, session.email);
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en sync';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
