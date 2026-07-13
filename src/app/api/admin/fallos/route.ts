import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { validateFalloFormPayload } from '@/lib/fallo-form-payload';
import { readFalloFormBody, validateFalloPdfFile } from '@/lib/fallo-request-body';
import {
  deleteFalloDocument,
  listAdminFallos,
  loadCatalogLookupsForFallo,
  reserveNextExpediente,
  saveFalloDocument,
} from '@/lib/observatorio-store';
import { buildFalloDocumentFromForm } from '@/lib/observatorio-normalize';
import { uploadFalloPdfToStorage } from '@/lib/fallo-files-server';
import { assertPdfNotDuplicate } from '@/lib/fallo-pdf-duplicate';
import { DuplicateFalloPdfError } from '@/lib/fallo-pdf-duplicate-error';
import { duplicateFalloPdfResponse } from '@/lib/fallo-pdf-duplicate-response';

async function readCreateBody(request: NextRequest) {
  return readFalloFormBody(request);
}

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
        createdAt: fallo.createdAt,
        updatedAt: fallo.updatedAt,
        status: fallo.status,
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

  const { payload, pdfFile } = await readCreateBody(request);
  if (!payload) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  if (pdfFile) {
    const pdfError = validateFalloPdfFile(pdfFile);
    if (pdfError) {
      return NextResponse.json({ error: pdfError }, { status: 400 });
    }
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

    if (pdfFile) {
      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      const pdfHash = await assertPdfNotDuplicate(buffer);
      const fileEntry = await uploadFalloPdfToStorage(
        nroExpediente,
        buffer,
        pdfFile.name
      );
      fallo.files = [fileEntry];
      fallo.pdfHash = pdfHash;
    }

    await saveFalloDocument(fallo);

    return NextResponse.json({
      ok: true,
      nroExpediente,
      url: `/observatorio/fallo/${nroExpediente}`,
    });
  } catch (error) {
    if (error instanceof DuplicateFalloPdfError) {
      return duplicateFalloPdfResponse(error);
    }
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
