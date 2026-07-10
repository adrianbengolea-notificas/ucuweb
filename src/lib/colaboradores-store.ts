import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import type { ColaboradorDocument, PublicColaborador } from '@/types/colaboradores';

const FALLO_POINTS = 10;
const COMMENT_POINTS = 3;

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado');
  return db;
}

function computeScore(fallosCount: number, commentsCount: number): number {
  return fallosCount * FALLO_POINTS + commentsCount * COMMENT_POINTS;
}

function toPublicColaborador(doc: ColaboradorDocument): PublicColaborador {
  return {
    uid: doc.uid,
    name: doc.name,
    photoUrl: doc.photoUrl,
    fallosCount: doc.fallosCount,
    commentsCount: doc.commentsCount,
    score: doc.score,
  };
}

export async function upsertColaboradorFromGoogle(input: {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
}): Promise<ColaboradorDocument> {
  const db = dbOrThrow();
  const ref = db.collection('colaboradores').doc(input.uid);
  const existing = await ref.get();
  const now = new Date().toISOString();

  if (existing.exists) {
    const data = existing.data() as ColaboradorDocument;
    const updated: ColaboradorDocument = {
      ...data,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim() || data.name,
      photoUrl: input.photoUrl?.trim() || data.photoUrl,
    };
    await ref.set(updated, { merge: true });
    return updated;
  }

  const created: ColaboradorDocument = {
    uid: input.uid,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim() || input.email.split('@')[0] || 'Colaborador',
    photoUrl: input.photoUrl?.trim() || undefined,
    fallosCount: 0,
    commentsCount: 0,
    score: 0,
    createdAt: now,
    lastContributionAt: now,
  };
  await ref.set(created);
  return created;
}

export async function getColaboradorByUid(uid: string): Promise<ColaboradorDocument | null> {
  const db = dbOrThrow();
  const doc = await db.collection('colaboradores').doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as ColaboradorDocument;
}

export async function incrementColaboradorStats(
  uid: string,
  delta: { fallos?: number; comments?: number }
): Promise<void> {
  const db = dbOrThrow();
  const ref = db.collection('colaboradores').doc(uid);
  const doc = await ref.get();
  if (!doc.exists) return;

  const data = doc.data() as ColaboradorDocument;
  const fallosCount = data.fallosCount + (delta.fallos ?? 0);
  const commentsCount = data.commentsCount + (delta.comments ?? 0);

  await ref.update({
    fallosCount,
    commentsCount,
    score: computeScore(fallosCount, commentsCount),
    lastContributionAt: new Date().toISOString(),
  });
}

export async function getTopColaboradores(limit = 10): Promise<PublicColaborador[]> {
  const db = dbOrThrow();

  try {
    const snap = await db
      .collection('colaboradores')
      .where('score', '>', 0)
      .orderBy('score', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => toPublicColaborador(doc.data() as ColaboradorDocument));
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 9) throw error;

    const snap = await db.collection('colaboradores').limit(200).get();
    return snap.docs
      .map((doc) => toPublicColaborador(doc.data() as ColaboradorDocument))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
