import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { countAdminReclamosByBandeja, countAssignedReclamos } from '@/lib/reclamos-store';

export async function GET(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const [counts, assignedCount] = await Promise.all([
      countAdminReclamosByBandeja(),
      countAssignedReclamos(session.email, session.name),
    ]);

    return NextResponse.json({ counts, assignedCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }
}
