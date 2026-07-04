import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { generateContestacionBorrador } from '@/lib/gemini';
import type { ReclamoSearchHit, ReclamoSearchStats } from '@/types/reclamos-search';

export async function POST(request: NextRequest) {
  if (!requireAdminPermission(request, 'reclamos:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const interpretacion =
    typeof body.interpretacion === 'string' ? body.interpretacion.trim() : '';
  const stats = body.stats as ReclamoSearchStats | undefined;
  const hits = body.hits as ReclamoSearchHit[] | undefined;

  if (!instruction) {
    return NextResponse.json({ error: 'Falta la instrucción original' }, { status: 400 });
  }
  if (!stats || !hits?.length) {
    return NextResponse.json(
      { error: 'Primero realizá una búsqueda con resultados' },
      { status: 400 }
    );
  }

  try {
    const casos = hits.slice(0, 50).map((hit) => ({
      id: hit.id,
      resumen: hit.resumen,
      empresas: hit.empresaNombres.join('; ') || '—',
      estado: hit.estadoDescripcion,
      fecha: hit.createdAt.slice(0, 10),
    }));

    const borrador = await generateContestacionBorrador({
      instruction,
      interpretacion: interpretacion || 'Búsqueda de reclamos',
      stats,
      casos,
    });

    return NextResponse.json({ borrador });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'No se pudo generar el borrador';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
