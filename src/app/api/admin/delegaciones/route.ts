import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { parseDelegacionForm } from '@/lib/delegaciones-form';
import {
  listDelegacionesAdmin,
  saveDelegacion,
  uniqueDelegacionSlug,
  uploadDelegadoPhoto,
} from '@/lib/delegaciones-store';
import type { Delegado } from '@/types/delegaciones';

async function buildDelegadosWithPhotos(
  delegacionSlug: string,
  parsed: ReturnType<typeof parseDelegacionForm>
): Promise<Delegado[]> {
  const delegados: Delegado[] = [];

  for (const delegado of parsed.delegados) {
    if (!delegado.nombre.trim()) continue;

    let fotoUrl = delegado.removePhoto ? null : delegado.fotoUrl;
    const photo = parsed.photos.get(delegado.id);
    if (photo) {
      fotoUrl = await uploadDelegadoPhoto(delegacionSlug, delegado.id, photo);
    }

    delegados.push({
      id: delegado.id,
      nombre: delegado.nombre.trim(),
      fotoUrl,
    });
  }

  return delegados;
}

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'delegaciones:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const delegaciones = await listDelegacionesAdmin();
    return NextResponse.json({ delegaciones });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al cargar delegaciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdminPermission(request, 'delegaciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const parsed = parseDelegacionForm(await request.formData());

    if (!parsed.nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    if (!parsed.provincia) {
      return NextResponse.json({ error: 'La provincia es obligatoria' }, { status: 400 });
    }

    const slug = parsed.requestedSlug
      ? await uniqueDelegacionSlug(parsed.requestedSlug)
      : await uniqueDelegacionSlug(parsed.nombre);

    const delegados = await buildDelegadosWithPhotos(slug, parsed);

    const delegacion = await saveDelegacion({
      slug,
      nombre: parsed.nombre,
      provincia: parsed.provincia,
      delegados,
      webUrl: parsed.webUrl,
      facebookUrl: parsed.facebookUrl,
      instagramUrl: parsed.instagramUrl,
      twitterUrl: parsed.twitterUrl,
      email: parsed.email,
      telefono: parsed.telefono,
      direccion: parsed.direccion,
      orden: parsed.orden,
      status: parsed.status,
    });

    return NextResponse.json({
      ok: true,
      delegacion,
      url: `/admin/delegaciones/${delegacion.slug}/editar`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al crear delegación' },
      { status: 500 }
    );
  }
}
