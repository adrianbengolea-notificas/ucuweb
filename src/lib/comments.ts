import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import { stripHtml } from '@/lib/format';
import type { CommentDocument, CommentStatus, PublicComment } from '@/types/comments';

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado');
  return db;
}

export function buildCommentTree(comments: PublicComment[]): PublicComment[] {
  const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as PublicComment[] }]));
  const roots: PublicComment[] = [];

  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)!.replies!.push(comment);
    } else {
      roots.push(comment);
    }
  }

  const sortByDate = (list: PublicComment[]) =>
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const sortTree = (nodes: PublicComment[]) => {
    sortByDate(nodes);
    nodes.forEach((node) => {
      if (node.replies?.length) sortTree(node.replies);
    });
  };

  sortTree(roots);
  return roots;
}

export async function getApprovedCommentsForPost(postSlug: string): Promise<PublicComment[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection('comments')
    .where('postSlug', '==', postSlug)
    .where('status', '==', 'approved')
    .orderBy('createdAt', 'asc')
    .get();

  const comments = snap.docs.map((doc) => {
    const data = doc.data() as CommentDocument;
    return {
      id: data.id,
      parentId: data.parentId,
      authorName: data.authorName,
      content: data.content,
      isAdminReply: data.isAdminReply,
      createdAt: data.createdAt,
    };
  });

  return buildCommentTree(comments);
}

export async function getCommentsForAdmin(options: {
  status?: CommentStatus | 'all';
  postSlug?: string;
  limit?: number;
}): Promise<CommentDocument[]> {
  const db = dbOrThrow();
  const limit = options.limit ?? 100;

  let query: FirebaseFirestore.Query = db.collection('comments');

  if (options.status && options.status !== 'all') {
    query = query.where('status', '==', options.status);
  }
  if (options.postSlug) {
    query = query.where('postSlug', '==', options.postSlug);
  }

  const mapDocs = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.docs.map((doc) => doc.data() as CommentDocument);

  const sortDesc = (items: CommentDocument[]) =>
    items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

  try {
    const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return mapDocs(snap);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 9) throw error;

    const snap = await query.limit(Math.min(limit * 5, 500)).get();
    return sortDesc(mapDocs(snap));
  }
}

export async function getCommentById(id: string): Promise<CommentDocument | null> {
  const db = dbOrThrow();
  const doc = await db.collection('comments').doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as CommentDocument;
}

export function sanitizeCommentContent(content: string): string {
  return stripHtml(content).trim().slice(0, 5000);
}

export function sanitizeAuthorName(name: string): string {
  return name.trim().slice(0, 80);
}
