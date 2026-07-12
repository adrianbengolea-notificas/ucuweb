import { NextRequest, NextResponse } from 'next/server';
import { incrementColaboradorStats } from '@/lib/colaboradores-store';
import { requireColaboradorSession } from '@/lib/colaborador-session';
import { createFalloComment, getCommentsForFallo } from '@/lib/fallo-comments';
import { getFalloById } from '@/lib/observatorio';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const falloId = Number(id);
  if (!Number.isFinite(falloId)) {
    return NextResponse.json({ comments: [], count: 0 });
  }

  try {
    const comments = await getCommentsForFallo(falloId);
    return NextResponse.json({ comments, count: comments.length });
  } catch {
    return NextResponse.json({ comments: [], count: 0 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = requireColaboradorSession(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Tenés que registrarte con Google para comentar fallos.' },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const falloId = Number(id);
  if (!Number.isFinite(falloId)) {
    return NextResponse.json({ error: 'Fallo inválido' }, { status: 400 });
  }

  const fallo = await getFalloById(falloId);
  if (!fallo) {
    return NextResponse.json({ error: 'Fallo no encontrado' }, { status: 404 });
  }

  let body: { content?: string; parentId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const comment = await createFalloComment({
      falloId,
      colaboradorUid: session.uid,
      authorName: session.name,
      authorPhotoUrl: session.photoUrl,
      content: String(body.content || ''),
      parentId: body.parentId ?? null,
    });

    await incrementColaboradorStats(session.uid, { comments: 1 });

    return NextResponse.json({
      ok: true,
      comment: {
        id: comment.id,
        parentId: comment.parentId,
        authorName: comment.authorName,
        authorPhotoUrl: comment.authorPhotoUrl,
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el comentario';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
