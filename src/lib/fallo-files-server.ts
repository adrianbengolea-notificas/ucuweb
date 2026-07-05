import 'server-only';

import { getAdminStorage } from '@/lib/firebase-admin';
import { falloStoragePath } from '@/lib/fallos-files';
import type { FalloFile } from '@/types/observatorio';

const MAX_PDF_BYTES = 12 * 1024 * 1024;

export function sanitizeFalloPdfFilename(originalName: string, nroExpediente: number): string {
  const trimmed = originalName.trim();
  const base = (trimmed || `fallo-${nroExpediente}.pdf`)
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_');

  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export async function uploadFalloPdfToStorage(
  nroExpediente: number,
  buffer: Buffer,
  originalName: string,
  fileId = 1
): Promise<FalloFile> {
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`El PDF supera el límite de ${MAX_PDF_BYTES / (1024 * 1024)} MB`);
  }

  const storage = getAdminStorage();
  if (!storage) throw new Error('Storage no configurado');

  const filename = sanitizeFalloPdfFilename(originalName, nroExpediente);
  const path = falloStoragePath(nroExpediente, filename);
  const bucket = storage.bucket();

  await bucket.file(path).save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return {
    id: fileId,
    file: filename,
    url: `/observatorio/fallos/${nroExpediente}/${filename}`,
  };
}
