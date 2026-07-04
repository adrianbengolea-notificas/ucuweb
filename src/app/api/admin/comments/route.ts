import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdminPermission } from '@/lib/admin-session';
import { getCommentsForAdmin, sanitizeAuthorName, sanitizeCommentContent } from '@/lib/comments';
import type { CommentDocument, CommentStatus } from '@/types/comments';

export async function GET(request: NextRequest) {
  const session = requireAdminPermission(request, 'comments:read');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const status = (request.nextUrl.searchParams.get('status') || 'pending') as
    | CommentStatus
    | 'all';
  const postSlug = request.nextUrl.searchParams.get('postSlug') || undefined;

  try {
    const comments = await getCommentsForAdmin({ status, postSlug, limit: 150 });
    const pendingCount = await getCommentsForAdmin({ status: 'pending', limit: 500 });

    return NextResponse.json({
      comments,
      pendingCount: pendingCount.length,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'No se pudieron cargar los comentarios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = requireAdminPermission(request, 'comments:write');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }

  let body: {
    postSlug?: string;
    parentId?: string | null;
    content?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const postSlug = String(body.postSlug || '').trim();
  const content = sanitizeCommentContent(String(body.content || ''));
  const parentId = body.parentId ? String(body.parentId) : null;

  if (!postSlug || content.length < 2) {
    return NextResponse.json({ error: 'Contenido y nota son obligatorios' }, { status: 400 });
  }

  const postDoc = await db.collection('posts').doc(postSlug).get();
  if (!postDoc.exists) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
  }

  if (parentId) {
    const parent = await db.collection('comments').doc(parentId).get();
    if (!parent.exists || parent.data()?.postSlug !== postSlug) {
      return NextResponse.json({ error: 'Comentario padre inválido' }, { status: 400 });
    }
  }

  const id = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const comment: CommentDocument = {
    id,
    postSlug,
    postTitle: postDoc.data()?.title,
    parentId,
    authorName: 'Usuarios y Consumidores Unidos',
    content,
    status: 'approved',
    isAdminReply: true,
    adminAuthor: session.email,
    createdAt: new Date().toISOString(),
  };

  await db.collection('comments').doc(id).set(comment);

  return NextResponse.json({ ok: true, comment });
}
