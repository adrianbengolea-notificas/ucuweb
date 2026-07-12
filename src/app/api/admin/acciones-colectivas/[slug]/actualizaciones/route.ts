import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { addActualizacion } from '@/lib/acciones-colectivas-store';
import type { ActualizacionStatus } from '@/types/acciones-colectivas';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'acciones:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const text = String(body.body ?? '').trim();
    const status = (body.status ?? 'publish') as ActualizacionStatus;

    if (!text) {
      return NextResponse.json({ error: 'El texto de la actualización es obligatorio' }, { status: 400 });
    }

    const actualizacion = await addActualizacion(
      slug,
      { title, body: text, status },
      { name: session.name, email: session.email }
    );

    return NextResponse.json({ ok: true, actualizacion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al agregar actualización' },
      { status: 500 }
    );
  }
}
