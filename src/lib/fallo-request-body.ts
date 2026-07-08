import type { NextRequest } from 'next/server';
import { parseFalloFormPayload } from '@/lib/fallo-form-payload';
import type { FalloFormPayload } from '@/types/observatorio';

export async function readFalloFormBody(request: NextRequest): Promise<{
  payload: FalloFormPayload | null;
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

export function validateFalloPdfFile(pdfFile: File): string | null {
  if (pdfFile.type !== 'application/pdf' && !pdfFile.name.toLowerCase().endsWith('.pdf')) {
    return 'Solo se aceptan archivos PDF';
  }
  return null;
}
