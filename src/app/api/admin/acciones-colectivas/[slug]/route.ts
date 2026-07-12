import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import {
  deleteAccionColectiva,
  getAccionColectivaWithActualizaciones,
  saveAccionColectiva,
} from '@/lib/acciones-colectivas-store';
import type { AccionColectivaStatus } from '@/types/acciones-colectivas';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'acciones:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    const accion = await getAccionColectivaWithActualizaciones(slug, { includeDrafts: true });
    if (!accion) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ accion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al cargar acción' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'acciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const status = body.status as AccionColectivaStatus | undefined;

    if (!title) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
    }

    const accion = await saveAccionColectiva({
      existingSlug: slug,
      title,
      summary,
      status: status ?? 'draft',
    });

    return NextResponse.json({ ok: true, accion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al actualizar acción' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'acciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    await deleteAccionColectiva(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar acción' },
      { status: 500 }
    );
  }
}
