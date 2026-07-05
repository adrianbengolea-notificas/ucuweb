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
import { uploadFalloPdfToStorage } from '@/lib/fallo-files-server';

async function readCreateBody(request: NextRequest): Promise<{
  payload: ReturnType<typeof parseFalloFormPayload>;
  pdfFile: File | null;
}> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const payloadRaw = formData.get('payload');
    const pdfEntry = formData.get('pdf');

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(payloadRaw ?? ''));
    } catch {
      return { payload: null, pdfFile: null };
    }

    const pdfFile =
      pdfEntry instanceof File && pdfEntry.size > 0 ? pdfEntry : null;

    return { payload: parseFalloFormPayload(parsed), pdfFile };
  }

  return {
    payload: parseFalloFormPayload(await request.json()),
    pdfFile: null,
  };
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

  const { payload, pdfFile } = await readCreateBody(request);
  if (!payload) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  if (pdfFile) {
    if (pdfFile.type !== 'application/pdf' && !pdfFile.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });
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
      const fileEntry = await uploadFalloPdfToStorage(
        nroExpediente,
        buffer,
        pdfFile.name
      );
      fallo.files = [fileEntry];
    }

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
