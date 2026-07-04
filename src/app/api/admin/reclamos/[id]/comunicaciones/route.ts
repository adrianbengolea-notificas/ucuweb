import { NextRequest, NextResponse } from 'next/server';
import { addReclamoComunicacion } from '@/lib/reclamos-store';
import { sendEmail } from '@/lib/email';
import {
  reclamoWriteForbiddenResponse,
  requireReclamoWriteAccess,
} from '@/lib/reclamos-access';
import { requireAdminPermission } from '@/lib/admin-session';

export async function POST(
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
    const session = requireAdminPermission(request, 'reclamos:write');
    if (session) return reclamoWriteForbiddenResponse();
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { session, reclamo } = access;

  const body = await request.json();
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  const viaIA = body?.viaIA === true;

  if (!subject || !text) {
    return NextResponse.json({ error: 'Asunto y cuerpo son requeridos' }, { status: 400 });
  }

  const to = reclamo.denunciante.email;
  if (!to) {
    return NextResponse.json({ error: 'El denunciante no tiene email registrado' }, { status: 400 });
  }

  try {
    await sendEmail({ to, subject, body: text });

    await addReclamoComunicacion(reclamoId, {
      to,
      subject,
      body: text,
      sentAt: new Date().toISOString(),
      sentByEmail: session.email,
      sentByName: session.name,
      viaIA,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[comunicaciones]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo enviar el email' },
      { status: 500 }
    );
  }
}
