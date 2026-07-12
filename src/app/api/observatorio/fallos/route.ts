import { NextRequest, NextResponse } from 'next/server';
import { validateFalloFormPayload } from '@/lib/fallo-form-payload';
import { uploadFalloPdfToStorage } from '@/lib/fallo-files-server';
import { assertPdfNotDuplicate } from '@/lib/fallo-pdf-duplicate';
import { DuplicateFalloPdfError } from '@/lib/fallo-pdf-duplicate-error';
import { duplicateFalloPdfResponse } from '@/lib/fallo-pdf-duplicate-response';
import { readFalloFormBody, validateFalloPdfFile } from '@/lib/fallo-request-body';
import { buildFalloDocumentFromForm } from '@/lib/observatorio-normalize';
import { requireColaboradorSession } from '@/lib/colaborador-session';
import { incrementColaboradorStats } from '@/lib/colaboradores-store';
import {
  loadCatalogLookupsForFallo,
  reserveNextExpediente,
  saveFalloDocument,
} from '@/lib/observatorio-store';

export async function POST(request: NextRequest) {
  const { payload, pdfFile } = await readFalloFormBody(request);
  if (!payload) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  if (!pdfFile) {
    return NextResponse.json({ error: 'Tenés que adjuntar el PDF de la sentencia' }, { status: 400 });
  }

  const pdfError = validateFalloPdfFile(pdfFile);
  if (pdfError) {
    return NextResponse.json({ error: pdfError }, { status: 400 });
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

    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const pdfHash = await assertPdfNotDuplicate(buffer);
    const fileEntry = await uploadFalloPdfToStorage(nroExpediente, buffer, pdfFile.name);
    fallo.files = [fileEntry];
    fallo.pdfHash = pdfHash;

    const colaborador = requireColaboradorSession(request);
    if (colaborador) {
      fallo.submittedBy = {
        uid: colaborador.uid,
        name: colaborador.name,
        email: colaborador.email,
      };
    }

    await saveFalloDocument(fallo);

    if (colaborador) {
      await incrementColaboradorStats(colaborador.uid, { fallos: 1 });
    }

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
    return NextResponse.json({ error: 'No se pudo publicar el fallo' }, { status: 500 });
  }
}
