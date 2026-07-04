import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  getApprovedCommentsForPost,
  sanitizeAuthorName,
  sanitizeCommentContent,
} from '@/lib/comments';
import type { CommentDocument } from '@/types/comments';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const comments = await getApprovedCommentsForPost(slug);
    return NextResponse.json({ comments, count: comments.length });
  } catch {
    return NextResponse.json({ comments: [], count: 0 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 });
  }

  const postDoc = await db.collection('posts').doc(slug).get();
  if (!postDoc.exists) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
  }

  let body: {
    authorName?: string;
    authorEmail?: string;
    content?: string;
    parentId?: string | null;
    company?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.company) {
    return NextResponse.json({ ok: true, message: 'Comentario enviado' });
  }

  const authorName = sanitizeAuthorName(String(body.authorName || ''));
  const content = sanitizeCommentContent(String(body.content || ''));
  const authorEmail = String(body.authorEmail || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);

  if (!authorName || content.length < 3) {
    return NextResponse.json(
      { error: 'Nombre y comentario (mín. 3 caracteres) son obligatorios' },
      { status: 400 }
    );
  }

  const parentId = body.parentId ? String(body.parentId) : null;
  if (parentId) {
    const parent = await db.collection('comments').doc(parentId).get();
    if (!parent.exists || parent.data()?.postSlug !== slug) {
      return NextResponse.json({ error: 'Comentario padre inválido' }, { status: 400 });
    }
  }

  const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const post = postDoc.data();

  const comment: CommentDocument = {
    id,
    postSlug: slug,
    postTitle: post?.title,
    parentId,
    authorName,
    authorEmail: authorEmail || undefined,
    content,
    status: 'pending',
    isAdminReply: false,
    createdAt: new Date().toISOString(),
  };

  await db.collection('comments').doc(id).set(comment);

  return NextResponse.json({
    ok: true,
    message: 'Tu comentario fue enviado y quedará visible cuando un moderador lo apruebe.',
    pending: true,
  });
}
