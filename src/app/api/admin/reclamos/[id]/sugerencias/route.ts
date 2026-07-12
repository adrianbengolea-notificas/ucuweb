import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { requireReclamoWriteAccess } from '@/lib/reclamos-access';
import { addReclamoComentario } from '@/lib/reclamos-store';
import {
  listSugerenciasPendientes,
  actualizarEstadoSugerencia,
} from '@/lib/drive-sync';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await context.params;
  const reclamoId = Number(id);
  if (!Number.isFinite(reclamoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const sugerencias = await listSugerenciasPendientes(reclamoId);
    return NextResponse.json({ sugerencias });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const reclamoId = Number(id);
  if (!Number.isFinite(reclamoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const access = await requireReclamoWriteAccess(request, reclamoId);
  if (!access) {
    return NextResponse.json({ error: 'No autorizado o reclamo no encontrado' }, { status: 403 });
  }
  const { session } = access;

  const body = (await request.json()) as {
    sugerenciaId?: string;
    accion?: 'confirmar' | 'descartar';
    textoEditado?: string;
  };

  const { sugerenciaId, accion, textoEditado } = body;
  if (!sugerenciaId || !accion) {
    return NextResponse.json({ error: 'Faltan sugerenciaId o accion' }, { status: 400 });
  }

  try {
    if (accion === 'confirmar') {
      const texto = textoEditado?.trim() || '';
      if (!texto) {
        return NextResponse.json({ error: 'Falta el texto del movimiento' }, { status: 400 });
      }
      await addReclamoComentario(reclamoId, `[Drive IA] ${texto}`, {
        email: session.email,
        name: session.name,
      });
    }

    await actualizarEstadoSugerencia(
      reclamoId,
      sugerenciaId,
      accion === 'confirmar' ? 'confirmada' : 'descartada',
      session.email
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
