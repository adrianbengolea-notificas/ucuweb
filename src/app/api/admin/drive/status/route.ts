import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { getDriveConnection, deleteDriveConnection } from '@/lib/drive-auth';

export async function GET(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const connection = await getDriveConnection(session.email);
  if (!connection) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    googleEmail: connection.googleEmail,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt ?? null,
  });
}

export async function DELETE(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await deleteDriveConnection(session.email);
  return NextResponse.json({ ok: true });
}
