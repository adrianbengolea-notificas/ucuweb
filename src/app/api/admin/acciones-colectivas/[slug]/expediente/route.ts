import { NextRequest, NextResponse } from 'next/server';
import { extractExpedienteTimeline } from '@/lib/accion-colectiva-ai-extract';
import { EXPEDIENTE_MAX_MB, uploadExpedientePdf } from '@/lib/acciones-colectivas-files';
import { getAccionColectiva, setExpedientePdf } from '@/lib/acciones-colectivas-store';
import { requireAdminPermission } from '@/lib/admin-session';
import { getGeminiApiKey } from '@/lib/gemini';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'acciones:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  return NextResponse.json({
    geminiConfigured: Boolean(getGeminiApiKey()),
    maxPdfMb: EXPEDIENTE_MAX_MB,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'acciones:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!getGeminiApiKey()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY no configurada en .env.local' },
      { status: 503 }
    );
  }

  const { slug } = await context.params;
  const accion = await getAccionColectiva(slug);
  if (!accion) {
    return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('pdf');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Subí un archivo PDF del expediente' }, { status: 400 });
  }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const [extraccion, expedientePdf] = await Promise.all([
      extractExpedienteTimeline(buffer, { tituloAccion: accion.title }),
      uploadExpedientePdf(slug, buffer, file.name, {
        name: session.name,
        email: session.email,
      }),
    ]);

    await setExpedientePdf(slug, expedientePdf);

    return NextResponse.json({
      ok: true,
      extraccion,
      expedientePdf,
      pasosCount: extraccion.pasos.length,
    });
  } catch (error) {
    console.error('[acciones-colectivas/expediente]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al analizar el expediente' },
      { status: 500 }
    );
  }
}
