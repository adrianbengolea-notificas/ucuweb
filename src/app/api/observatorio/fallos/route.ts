import { NextRequest, NextResponse } from 'next/server';
import { parseFalloFormPayload, validateFalloFormPayload } from '@/lib/fallo-form-payload';
import { buildFalloDocumentFromForm } from '@/lib/observatorio-normalize';
import {
  loadCatalogLookupsForFallo,
  reserveNextExpediente,
  saveFalloDocument,
} from '@/lib/observatorio-store';

export async function POST(request: NextRequest) {
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
    const fallo = buildFalloDocumentFromForm({ ...payload, status: 'publish' }, catalogs);
    fallo.nroExpediente = nroExpediente;
    await saveFalloDocument(fallo);

    return NextResponse.json({
      ok: true,
      nroExpediente,
      url: `/observatorio/fallo/${nroExpediente}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo publicar el fallo' }, { status: 500 });
  }
}
