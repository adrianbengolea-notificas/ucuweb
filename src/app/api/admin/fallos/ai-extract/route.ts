import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { extractFalloFormFromPdf } from '@/lib/fallo-ai-extract';
import { getGeminiApiKey } from '@/lib/gemini';

const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'fallos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  return NextResponse.json({
    geminiConfigured: Boolean(getGeminiApiKey()),
    maxPdfMb: MAX_PDF_BYTES / (1024 * 1024),
  });
}

export async function POST(request: NextRequest) {
  if (!requireAdminPermission(request, 'fallos:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!getGeminiApiKey()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY no configurada en .env.local' },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('pdf');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Subí un archivo PDF' }, { status: 400 });
  }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `El PDF supera el límite de ${MAX_PDF_BYTES / (1024 * 1024)} MB` },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractFalloFormFromPdf(buffer);

    return NextResponse.json({
      ok: true,
      form: result.form,
      warnings: result.warnings,
      resumenLength: result.form.resumen.length,
    });
  } catch (error) {
    console.error('[fallos/ai-extract]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al analizar el PDF' },
      { status: 500 }
    );
  }
}
