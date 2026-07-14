import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { countAdminReclamosRecibidos } from '@/lib/reclamos-store';

export async function GET(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const recibidos = await countAdminReclamosRecibidos();

    return NextResponse.json({
      counts: {
        recibidos,
        gestion: 0,
        archivados: 0,
      },
      // La campana del shell no usa assignedCount; se calcula al listar Asignados.
      assignedCount: 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }
}
