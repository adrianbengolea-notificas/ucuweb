import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import {
  listAccionesColectivasAdmin,
  saveAccionColectiva,
  uniqueAccionSlug,
} from '@/lib/acciones-colectivas-store';
import type { AccionColectivaStatus } from '@/types/acciones-colectivas';

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'acciones:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const acciones = await listAccionesColectivasAdmin();
    return NextResponse.json({ acciones });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al cargar acciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = requireAdminPermission(request, 'acciones:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const status = (body.status ?? 'draft') as AccionColectivaStatus;
    const requestedSlug = String(body.slug ?? '').trim();

    if (!title) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
    }

    const slug = requestedSlug
      ? await uniqueAccionSlug(requestedSlug)
      : await uniqueAccionSlug(title);

    const accion = await saveAccionColectiva({ slug, title, summary, status });
    return NextResponse.json({ ok: true, accion, url: `/admin/acciones-colectivas/${accion.slug}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al crear acción' },
      { status: 500 }
    );
  }
}
