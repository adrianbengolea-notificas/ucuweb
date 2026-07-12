import 'server-only';

import { getAdminStorage } from '@/lib/firebase-admin';
import type { AccionColectivaAuthor, ExpedientePdf } from '@/types/acciones-colectivas';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function expedienteStoragePath(slug: string, filename: string): string {
  return `acciones-colectivas/${slug}/${filename}`;
}

export function sanitizeExpedienteFilename(originalName: string, slug: string): string {
  const trimmed = originalName.trim();
  const base = (trimmed || `expediente-${slug}.pdf`)
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_');

  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export async function uploadExpedientePdf(
  slug: string,
  buffer: Buffer,
  originalName: string,
  uploadedBy: AccionColectivaAuthor
): Promise<ExpedientePdf> {
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`El PDF supera el límite de ${MAX_PDF_BYTES / (1024 * 1024)} MB`);
  }

  const storage = getAdminStorage();
  if (!storage) throw new Error('Storage no configurado');

  const filename = sanitizeExpedienteFilename(originalName, slug);
  const storagePath = expedienteStoragePath(slug, filename);
  const bucket = storage.bucket();

  await bucket.file(storagePath).save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      cacheControl: 'private, max-age=3600',
    },
  });

  return {
    filename,
    storagePath,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };
}

export const EXPEDIENTE_MAX_MB = MAX_PDF_BYTES / (1024 * 1024);
