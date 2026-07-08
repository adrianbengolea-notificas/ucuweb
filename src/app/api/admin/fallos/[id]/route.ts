import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { validateFalloFormPayload } from '@/lib/fallo-form-payload';
import { readFalloFormBody, validateFalloPdfFile } from '@/lib/fallo-request-body';
import { uploadFalloPdfToStorage } from '@/lib/fallo-files-server';
import { assertPdfNotDuplicate } from '@/lib/fallo-pdf-duplicate';
import { DuplicateFalloPdfError } from '@/lib/fallo-pdf-duplicate-error';
import { duplicateFalloPdfResponse } from '@/lib/fallo-pdf-duplicate-response';
import { buildFalloDocumentFromForm } from '@/lib/observatorio-normalize';
import {
  getStoredFalloById,
  loadCatalogLookupsForFallo,
  saveFalloDocument,
} from '@/lib/observatorio-store';

async function readUpdateBody(request: NextRequest) {
  return readFalloFormBody(request);
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

  const { payload, pdfFile } = await readUpdateBody(request);
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
    const existing = await getStoredFalloById(nroExpediente);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const catalogs = await loadCatalogLookupsForFallo(payload);
    const fallo = buildFalloDocumentFromForm(payload, catalogs, existing);
    fallo.nroExpediente = nroExpediente;

    if (pdfFile) {
      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      const pdfHash = await assertPdfNotDuplicate(buffer, nroExpediente);
      const existingPdf = existing.files?.find((file) => file.file.toLowerCase().endsWith('.pdf'));
      const nextFileId =
        existingPdf?.id ??
        (existing.files?.reduce((max, file) => Math.max(max, file.id), 0) ?? 0) + 1;
      const fileEntry = await uploadFalloPdfToStorage(
        nroExpediente,
        buffer,
        pdfFile.name,
        nextFileId
      );
      const otherFiles = (existing.files ?? []).filter((file) => file.id !== nextFileId);
      fallo.files = [...otherFiles, fileEntry];
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
    return NextResponse.json({ error: 'No se pudo actualizar el fallo' }, { status: 500 });
  }
}
