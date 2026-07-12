import type { DelegacionStatus, Delegado } from '@/types/delegaciones';

export type ParsedDelegacionForm = {
  nombre: string;
  requestedSlug: string;
  provincia: string;
  webUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  email: string;
  telefono: string;
  direccion: string;
  orden: number;
  status: DelegacionStatus;
  delegados: Array<Delegado & { removePhoto: boolean }>;
  photos: Map<string, File>;
};

export function parseDelegacionForm(form: FormData): ParsedDelegacionForm {
  const statusRaw = String(form.get('status') || 'publish');
  const delegadosRaw = String(form.get('delegados') || '[]');

  let delegados: Array<Delegado & { removePhoto: boolean }> = [];
  try {
    const parsed = JSON.parse(delegadosRaw) as Array<{
      id: string;
      nombre: string;
      fotoUrl?: string | null;
      removePhoto?: boolean;
    }>;
    delegados = parsed.map((d) => ({
      id: String(d.id),
      nombre: String(d.nombre ?? '').trim(),
      fotoUrl: d.fotoUrl ?? null,
      removePhoto: Boolean(d.removePhoto),
    }));
  } catch {
    delegados = [];
  }

  const photos = new Map<string, File>();
  for (const [key, value] of form.entries()) {
    if (key.startsWith('photo_') && value instanceof File && value.size > 0) {
      photos.set(key.replace('photo_', ''), value);
    }
  }

  return {
    nombre: String(form.get('nombre') || '').trim(),
    requestedSlug: String(form.get('slug') || '').trim(),
    provincia: String(form.get('provincia') || '').trim(),
    webUrl: String(form.get('webUrl') || '').trim(),
    facebookUrl: String(form.get('facebookUrl') || '').trim(),
    instagramUrl: String(form.get('instagramUrl') || '').trim(),
    twitterUrl: String(form.get('twitterUrl') || '').trim(),
    email: String(form.get('email') || '').trim(),
    telefono: String(form.get('telefono') || '').trim(),
    direccion: String(form.get('direccion') || '').trim(),
    orden: Number(String(form.get('orden') || '0')) || 0,
    status: statusRaw === 'draft' ? 'draft' : 'publish',
    delegados,
    photos,
  };
}
