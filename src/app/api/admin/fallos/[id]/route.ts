import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { buildFalloDocumentFromForm } from '@/lib/observatorio-normalize';
import {
  getStoredFalloById,
  loadCatalogLookupsForFallo,
  saveFalloDocument,
} from '@/lib/observatorio-store';
import type { FalloFormPayload } from '@/types/observatorio';

function parsePayload(body: unknown): FalloFormPayload | null {
  if (!body || typeof body !== 'object') return null;
  const data = body as Record<string, unknown>;

  const readString = (key: string) => String(data[key] ?? '');
  const readNumberArray = (key: string) =>
    Array.isArray(data[key])
      ? data[key].map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
  const readNullableNumber = (key: string) => {
    const value = data[key];
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const readBool = (key: string) => Boolean(data[key]);

  return {
    actor: readString('actor'),
    demandado: readString('demandado'),
    firmActor: readBool('firmActor'),
    personDemandado: readBool('personDemandado'),
    actorEmpresaIds: readNumberArray('actorEmpresaIds'),
    demandadoEmpresaIds: readNumberArray('demandadoEmpresaIds'),
    divisaId: readNullableNumber('divisaId'),
    resumen: readString('resumen'),
    fecha: readString('fecha'),
    tipoJuicioId: readNullableNumber('tipoJuicioId'),
    rubroIds: readNumberArray('rubroIds'),
    causaIds: readNumberArray('causaIds'),
    etiquetaIds: readNumberArray('etiquetaIds'),
    provinciaId: readNullableNumber('provinciaId'),
    ciudadId: readNullableNumber('ciudadId'),
    juzgadoId: readNullableNumber('juzgadoId'),
    punitivo: readString('punitivo') || '0.00',
    moral: readString('moral') || '0.00',
    patrimonial: readString('patrimonial') || '0.00',
    status: data.status === 'draft' ? 'draft' : 'publish',
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!requireAdminPermission(request, 'fallos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const nroExpediente = Number(id);
  if (!Number.isFinite(nroExpediente)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const fallo = await getStoredFalloById(nroExpediente);
    if (!fallo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ fallo });
  } catch {
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!requireAdminPermission(request, 'fallos:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const nroExpediente = Number(id);
  if (!Number.isFinite(nroExpediente)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const payload = parsePayload(await request.json());
  if (!payload?.resumen.trim()) {
    return NextResponse.json({ error: 'El resumen es obligatorio' }, { status: 400 });
  }
  if (payload.firmActor) {
    if (!payload.actorEmpresaIds.length) {
      return NextResponse.json(
        { error: 'Seleccioná al menos una empresa como actor' },
        { status: 400 }
      );
    }
  } else if (!payload.actor.trim()) {
    return NextResponse.json({ error: 'El actor es obligatorio' }, { status: 400 });
  }

  try {
    const existing = await getStoredFalloById(nroExpediente);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const catalogs = await loadCatalogLookupsForFallo(payload);
    const fallo = buildFalloDocumentFromForm(payload, catalogs, existing);
    fallo.nroExpediente = nroExpediente;
    await saveFalloDocument(fallo);

    return NextResponse.json({
      ok: true,
      nroExpediente,
      url: `/observatorio/fallo/${nroExpediente}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo actualizar el fallo' }, { status: 500 });
  }
}
