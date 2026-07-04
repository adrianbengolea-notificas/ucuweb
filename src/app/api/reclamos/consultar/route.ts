import { NextRequest, NextResponse } from 'next/server';
import { findReclamoByIdAndDocumento } from '@/lib/reclamos-store';
import { toReclamoPublicView } from '@/lib/reclamos-normalize';

export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get('id'));
  const documento = request.nextUrl.searchParams.get('documento') ?? '';

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Número de reclamo inválido' }, { status: 400 });
  }
  if (!documento.trim()) {
    return NextResponse.json({ error: 'Documento requerido' }, { status: 400 });
  }

  try {
    const reclamo = await findReclamoByIdAndDocumento(id, documento);
    if (!reclamo) {
      return NextResponse.json({ error: 'Reclamo no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ reclamo: toReclamoPublicView(reclamo) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Consulta no disponible' }, { status: 503 });
  }
}
