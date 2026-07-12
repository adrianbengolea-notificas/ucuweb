import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { getReclamoEstadisticasFiltrosCatalogos } from '@/lib/reclamos-stats';

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'reclamos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const catalogos = await getReclamoEstadisticasFiltrosCatalogos();
    return NextResponse.json(catalogos);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudieron cargar los catálogos' }, { status: 500 });
  }
}
