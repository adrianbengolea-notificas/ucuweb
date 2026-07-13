import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage } from '@/lib/firebase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = path.join('/');

  if (!storagePath.startsWith('media/')) {
    return NextResponse.json({ error: 'Ruta no permitida' }, { status: 400 });
  }

  const storage = getAdminStorage();
  if (!storage) {
    return NextResponse.json({ error: 'Storage no configurado' }, { status: 500 });
  }

  try {
    const file = storage.bucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al leer archivo' }, { status: 500 });
  }
}
