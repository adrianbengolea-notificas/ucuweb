import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdminPermission } from '@/lib/admin-session';
import { getCommentById } from '@/lib/comments';
import type { CommentStatus } from '@/types/comments';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'comments:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }

  const existing = await getCommentById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
  }

  let body: { status?: CommentStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const allowed: CommentStatus[] = ['pending', 'approved', 'spam', 'trash'];
  if (!body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  await db.collection('comments').doc(id).update({
    status: body.status,
    moderatedAt: new Date().toISOString(),
    moderatedBy: session.email,
  });

  return NextResponse.json({ ok: true, status: body.status });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = requireAdminPermission(request, 'comments:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }

  await db.collection('comments').doc(id).delete();
  return NextResponse.json({ ok: true });
}
