import 'server-only';

import { createHash } from 'crypto';
import { DuplicateFalloPdfError, duplicateFalloPdfMessage } from '@/lib/fallo-pdf-duplicate-error';
import { getAdminDb } from '@/lib/firebase-admin';
import type { StoredFalloDocument } from '@/types/observatorio';

export type FalloPdfDuplicateMatch = {
  nroExpediente: number;
  actor: string | null;
  fecha: string;
  url: string;
};

export function computePdfSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function findFalloByPdfHash(
  hash: string,
  excludeExpediente?: number
): Promise<FalloPdfDuplicateMatch | null> {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');

  const snap = await db.collection('fallos').where('pdfHash', '==', hash).limit(10).get();

  for (const doc of snap.docs) {
    const fallo = doc.data() as StoredFalloDocument;
    if (fallo.deletedAt) continue;
    if (excludeExpediente != null && fallo.nroExpediente === excludeExpediente) continue;

    return {
      nroExpediente: fallo.nroExpediente,
      actor: fallo.actor,
      fecha: fallo.fecha,
      url: `/observatorio/fallo/${fallo.nroExpediente}`,
    };
  }

  return null;
}

export async function findDuplicateFalloForPdfBuffer(
  buffer: Buffer,
  excludeExpediente?: number
): Promise<{ hash: string; match: FalloPdfDuplicateMatch | null }> {
  const hash = computePdfSha256(buffer);
  const match = await findFalloByPdfHash(hash, excludeExpediente);
  return { hash, match };
}

export async function assertPdfNotDuplicate(
  buffer: Buffer,
  excludeExpediente?: number
): Promise<string> {
  const { hash, match } = await findDuplicateFalloForPdfBuffer(buffer, excludeExpediente);
  if (match) {
    throw new DuplicateFalloPdfError(duplicateFalloPdfMessage(match), match);
  }
  return hash;
}
