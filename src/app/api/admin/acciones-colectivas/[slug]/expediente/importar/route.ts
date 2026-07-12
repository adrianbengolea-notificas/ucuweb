import { NextRequest, NextResponse } from 'next/server';
import {
  getAccionColectiva,
  importActualizacionesFromExpediente,
} from '@/lib/acciones-colectivas-store';
import { requireAdminPermission } from '@/lib/admin-session';
import type { ExpedientePasoExtraido } from '@/types/acciones-colectivas';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'acciones:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;
  const accion = await getAccionColectiva(slug);
  if (!accion) {
    return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const pasos = Array.isArray(body.pasos) ? (body.pasos as ExpedientePasoExtraido[]) : [];

    const validPasos = pasos.filter(
      (paso) =>
        paso &&
        typeof paso.fecha === 'string' &&
        typeof paso.titulo === 'string' &&
        typeof paso.descripcion === 'string' &&
        paso.descripcion.trim()
    );

    if (!validPasos.length) {
      return NextResponse.json({ error: 'Seleccioná al menos un paso para importar' }, { status: 400 });
    }

    const imported = await importActualizacionesFromExpediente(slug, validPasos, {
      name: session.name,
      email: session.email,
    });

    return NextResponse.json({
      ok: true,
      importedCount: imported.length,
    });
  } catch (error) {
    console.error('[acciones-colectivas/expediente/importar]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al importar pasos' },
      { status: 500 }
    );
  }
}
