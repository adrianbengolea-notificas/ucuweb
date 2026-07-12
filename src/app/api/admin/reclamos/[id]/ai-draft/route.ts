import { NextRequest, NextResponse } from 'next/server';
import { generateEmailDraftForReclamo, getGeminiApiKey } from '@/lib/gemini';
import {
  reclamoWriteForbiddenResponse,
  requireReclamoWriteAccess,
} from '@/lib/reclamos-access';
import { requireAdminPermission } from '@/lib/admin-session';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const reclamoId = Number(id);
  if (!Number.isFinite(reclamoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const access = await requireReclamoWriteAccess(request, reclamoId);
  if (!access) {
    const session = requireAdminPermission(request, 'reclamos:write');
    if (session) return reclamoWriteForbiddenResponse();
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { reclamo } = access;

  const body = await request.json();
  const plantilla = typeof body?.plantilla === 'string' ? body.plantilla : 'Actualización del caso';

  if (!getGeminiApiKey()) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY no configurada en el servidor. En producción, cargala como secreto en Firebase App Hosting.',
      },
      { status: 503 }
    );
  }

  const d = reclamo.denunciante;
  const nombreConsumidor = `${d.nombre} ${d.apellido}`;
  const empresas = reclamo.empresas.map((e) => e.nombre).join(', ') || reclamo.otrasEmpresas || '(sin empresa)';

  try {
    const draft = await generateEmailDraftForReclamo({
      reclamoId,
      nombreConsumidor,
      estadoActual: reclamo.estadoDescripcion ?? 'Consulta',
      resumen: reclamo.resumen,
      empresas,
      plantilla,
    });

    return NextResponse.json({ ok: true, ...draft });
  } catch (error) {
    console.error('[ai-draft]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar borrador' },
      { status: 500 }
    );
  }
}
