import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import { sanitizeAuthorName, sanitizeCommentContent } from '@/lib/comments';
import type { FalloCommentDocument, PublicFalloComment } from '@/types/fallo-comments';

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado');
  return db;
}

export function buildFalloCommentTree(comments: PublicFalloComment[]): PublicFalloComment[] {
  const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as PublicFalloComment[] }]));
  const roots: PublicFalloComment[] = [];

  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)!.replies!.push(comment);
    } else {
      roots.push(comment);
    }
  }

  const sortByDate = (list: PublicFalloComment[]) =>
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const sortTree = (nodes: PublicFalloComment[]) => {
    sortByDate(nodes);
    nodes.forEach((node) => {
      if (node.replies?.length) sortTree(node.replies);
    });
  };

  sortTree(roots);
  return roots;
}

export async function getCommentsForFallo(falloId: number): Promise<PublicFalloComment[]> {
  const db = dbOrThrow();

  try {
    const snap = await db
      .collection('fallo_comments')
      .where('falloId', '==', falloId)
      .orderBy('createdAt', 'asc')
      .get();

    const comments = snap.docs.map((doc) => {
      const data = doc.data() as FalloCommentDocument;
      return {
        id: data.id,
        parentId: data.parentId,
        authorName: data.authorName,
        authorPhotoUrl: data.authorPhotoUrl,
        content: data.content,
        createdAt: data.createdAt,
      };
    });

    return buildFalloCommentTree(comments);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 9) throw error;

    const snap = await db.collection('fallo_comments').where('falloId', '==', falloId).get();
    const comments = snap.docs
      .map((doc) => {
        const data = doc.data() as FalloCommentDocument;
        return {
          id: data.id,
          parentId: data.parentId,
          authorName: data.authorName,
          authorPhotoUrl: data.authorPhotoUrl,
          content: data.content,
          createdAt: data.createdAt,
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return buildFalloCommentTree(comments);
  }
}

export async function createFalloComment(input: {
  falloId: number;
  colaboradorUid: string;
  authorName: string;
  authorPhotoUrl?: string;
  content: string;
  parentId?: string | null;
}): Promise<FalloCommentDocument> {
  const db = dbOrThrow();
  const content = sanitizeCommentContent(input.content);
  const authorName = sanitizeAuthorName(input.authorName);

  if (!authorName || content.length < 3) {
    throw new Error('Nombre y comentario (mín. 3 caracteres) son obligatorios');
  }

  const parentId = input.parentId ? String(input.parentId) : null;
  if (parentId) {
    const parent = await db.collection('fallo_comments').doc(parentId).get();
    if (!parent.exists || parent.data()?.falloId !== input.falloId) {
      throw new Error('Comentario padre inválido');
    }
  }

  const id = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const comment: FalloCommentDocument = {
    id,
    falloId: input.falloId,
    parentId,
    colaboradorUid: input.colaboradorUid,
    authorName,
    authorPhotoUrl: input.authorPhotoUrl,
    content,
    createdAt: new Date().toISOString(),
  };

  await db.collection('fallo_comments').doc(id).set(comment);
  return comment;
}
