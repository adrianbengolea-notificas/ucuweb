import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { getReclamoCausasFromFirestore } from '@/lib/reclamos-store';

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'reclamos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const causas = await getReclamoCausasFromFirestore();
    return NextResponse.json({ causas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudieron cargar las causas' }, { status: 500 });
  }
}
