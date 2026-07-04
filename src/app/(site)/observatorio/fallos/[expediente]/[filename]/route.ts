import { NextRequest, NextResponse } from 'next/server';
import { falloStoragePath } from '@/lib/fallos-files';
import { getAdminStorage } from '@/lib/firebase-admin';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ expediente: string; filename: string }> }
) {
  const { expediente: expedienteRaw, filename: filenameRaw } = await context.params;
  const expediente = Number(expedienteRaw);
  const filename = decodeURIComponent(filenameRaw);

  if (!Number.isFinite(expediente) || !filename || filename.includes('..')) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  }

  const storage = getAdminStorage();
  if (!storage) {
    return NextResponse.json({ error: 'Storage no configurado' }, { status: 500 });
  }

  const storagePath = falloStoragePath(expediente, filename);

  try {
    const file = storage.bucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': metadata.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al leer archivo' }, { status: 500 });
  }
}
