import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { parseDelegacionForm } from '@/lib/delegaciones-form';
import {
  deleteDelegacion,
  getDelegacion,
  saveDelegacion,
  uniqueDelegacionSlug,
  uploadDelegadoPhoto,
} from '@/lib/delegaciones-store';
import type { Delegado } from '@/types/delegaciones';

type RouteContext = { params: Promise<{ slug: string }> };

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

export async function GET(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'delegaciones:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    const delegacion = await getDelegacion(slug);
    if (!delegacion) {
      return NextResponse.json({ error: 'Delegación no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ delegacion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al cargar delegación' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'delegaciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug: originalSlug } = await context.params;

  try {
    const existing = await getDelegacion(originalSlug);
    if (!existing) {
      return NextResponse.json({ error: 'Delegación no encontrada' }, { status: 404 });
    }

    const parsed = parseDelegacionForm(await request.formData());

    if (!parsed.nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    if (!parsed.provincia) {
      return NextResponse.json({ error: 'La provincia es obligatoria' }, { status: 400 });
    }

    const newSlug = parsed.requestedSlug
      ? await uniqueDelegacionSlug(parsed.requestedSlug, originalSlug)
      : originalSlug;

    const delegados = await buildDelegadosWithPhotos(newSlug, parsed);

    const delegacion = await saveDelegacion({
      existingSlug: originalSlug,
      slug: newSlug !== originalSlug ? newSlug : undefined,
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

    if (newSlug !== originalSlug) {
      await deleteDelegacion(originalSlug);
    }

    return NextResponse.json({ ok: true, delegacion, slug: delegacion.slug });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al actualizar delegación' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!requireAdminPermission(request, 'delegaciones:write')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    await deleteDelegacion(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar delegación' },
      { status: 500 }
    );
  }
}
