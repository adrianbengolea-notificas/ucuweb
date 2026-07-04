import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/admin-roles';
import {
  getAssigneeMatchContext,
  reclamoAssignedToIdentity,
} from '@/lib/admin-assignee-identity';
import { requireAdminPermission, type AdminSession } from '@/lib/admin-session';
import { getReclamoByIdFromFirestore } from '@/lib/reclamos-store';
import type { StoredReclamoDocument } from '@/types/reclamos';

export { getReclamosWriteScopeForRole } from '@/lib/admin-roles';

export async function canWriteReclamo(
  session: Pick<AdminSession, 'email' | 'name' | 'permissions' | 'reclamosWriteScope'>,
  reclamo: Pick<StoredReclamoDocument, 'responsable'>
): Promise<boolean> {
  if (!hasPermission(session.permissions, 'reclamos:write')) return false;
  if (session.reclamosWriteScope !== 'assigned') return true;

  const { emails, name } = await getAssigneeMatchContext(session.email);
  return reclamoAssignedToIdentity(reclamo, emails, name ?? session.name);
}

export async function requireReclamoWriteAccess(
  request: NextRequest,
  reclamoId: number
): Promise<{ session: AdminSession; reclamo: StoredReclamoDocument } | null> {
  const session = requireAdminPermission(request, 'reclamos:write');
  if (!session) return null;

  const reclamo = await getReclamoByIdFromFirestore(reclamoId);
  if (!reclamo) return null;
  if (!(await canWriteReclamo(session, reclamo))) return null;

  return { session, reclamo };
}

export function reclamoWriteForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Solo podés editar reclamos asignados a vos.' },
    { status: 403 }
  );
}
