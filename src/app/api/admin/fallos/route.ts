import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { parseFalloFormPayload, validateFalloFormPayload } from '@/lib/fallo-form-payload';
import {
  deleteFalloDocument,
  listAdminFallos,
  loadCatalogLookupsForFallo,
  reserveNextExpediente,
  saveFalloDocument,
} from '@/lib/observatorio-store';
import { buildFalloDocumentFromForm } from '@/lib/observatorio-normalize';

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'fallos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const fallos = await listAdminFallos();
    return NextResponse.json({
      fallos: fallos.map((fallo) => ({
        nroExpediente: fallo.nroExpediente,
        actor: fallo.actor,
        resumen: fallo.resumen,
        fecha: fallo.fecha,
        status: fallo.status,
        updatedAt: fallo.updatedAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdminPermission(request, 'fallos:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const payload = parseFalloFormPayload(await request.json());
  if (!payload) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const validationError = validateFalloFormPayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const catalogs = await loadCatalogLookupsForFallo(payload);
    const nroExpediente = await reserveNextExpediente();
    const fallo = buildFalloDocumentFromForm(payload, catalogs);
    fallo.nroExpediente = nroExpediente;
    await saveFalloDocument(fallo);

    return NextResponse.json({
      ok: true,
      nroExpediente,
      url: `/observatorio/fallo/${nroExpediente}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo crear el fallo' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!requireAdminPermission(request, 'fallos:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const id = Number(request.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    await deleteFalloDocument(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el fallo' }, { status: 500 });
  }
}
