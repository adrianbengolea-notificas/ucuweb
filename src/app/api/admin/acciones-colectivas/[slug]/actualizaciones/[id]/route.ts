import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { deleteActualizacion, updateActualizacion } from '@/lib/acciones-colectivas-store';
import type { ActualizacionStatus } from '@/types/acciones-colectivas';

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'acciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug, id } = await context.params;

  try {
    const body = await request.json();
    const actualizacion = await updateActualizacion(slug, id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      body: body.body !== undefined ? String(body.body) : undefined,
      status: body.status as ActualizacionStatus | undefined,
    });

    return NextResponse.json({ ok: true, actualizacion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al actualizar entrada' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'acciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug, id } = await context.params;

  try {
    await deleteActualizacion(slug, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar entrada' },
      { status: 500 }
    );
  }
}
