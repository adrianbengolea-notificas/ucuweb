import 'server-only';

import { getAdminDb, getAdminStorage } from '@/lib/firebase-admin';
import { slugify } from '@/lib/slug';
import type {
  DelegacionDocument,
  DelegacionListItem,
  DelegacionStatus,
  Delegado,
} from '@/types/delegaciones';

const COLLECTION = 'delegaciones';

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');
  return db;
}

export async function uniqueDelegacionSlug(base: string, excludeSlug?: string): Promise<string> {
  const db = dbOrThrow();
  let slug = slugify(base) || 'delegacion';
  let attempt = slug;
  let n = 2;

  while (true) {
    if (attempt === excludeSlug) return attempt;
    const snap = await db.collection(COLLECTION).doc(attempt).get();
    if (!snap.exists) return attempt;
    attempt = `${slug}-${n}`;
    n += 1;
  }
}

export async function uploadDelegadoPhoto(
  delegacionSlug: string,
  delegadoId: string,
  image: File
): Promise<string> {
  const storage = getAdminStorage();
  if (!storage) throw new Error('Storage no configurado');

  const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg';
  const date = new Date();
  const storagePath = `media/delegaciones/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${delegacionSlug}-${delegadoId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await image.arrayBuffer());
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: image.type || 'image/jpeg',
      cacheControl: 'public,max-age=31536000',
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function toListItem(data: DelegacionDocument): DelegacionListItem {
  return {
    slug: data.slug,
    nombre: data.nombre,
    provincia: data.provincia,
    delegados: data.delegados,
    status: data.status,
    orden: data.orden,
    modifiedAt: data.modifiedAt,
  };
}

function sortDelegaciones<T extends { provincia: string; orden: number; nombre: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const prov = a.provincia.localeCompare(b.provincia, 'es');
    if (prov !== 0) return prov;
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

export async function listDelegacionesAdmin(): Promise<DelegacionListItem[]> {
  const snap = await dbOrThrow().collection(COLLECTION).get();
  return sortDelegaciones(snap.docs.map((doc) => toListItem(doc.data() as DelegacionDocument)));
}

export async function listDelegacionesPublic(): Promise<DelegacionDocument[]> {
  const snap = await dbOrThrow().collection(COLLECTION).where('status', '==', 'publish').get();
  return sortDelegaciones(snap.docs.map((doc) => doc.data() as DelegacionDocument));
}

export async function getDelegacion(slug: string): Promise<DelegacionDocument | null> {
  const snap = await dbOrThrow().collection(COLLECTION).doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as DelegacionDocument;
}

export type SaveDelegacionInput = {
  nombre: string;
  provincia: string;
  delegados: Delegado[];
  webUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  orden?: number;
  status: DelegacionStatus;
  slug?: string;
  existingSlug?: string;
};

function normalizeUrl(value?: string | null): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export async function saveDelegacion(input: SaveDelegacionInput): Promise<DelegacionDocument> {
  const db = dbOrThrow();
  const now = new Date().toISOString();

  let slug: string;
  if (input.existingSlug) {
    slug =
      input.slug && input.slug !== input.existingSlug
        ? await uniqueDelegacionSlug(input.slug, input.existingSlug)
        : input.existingSlug;
  } else {
    slug = await uniqueDelegacionSlug(input.slug || input.nombre);
  }

  const existingDocId = input.existingSlug ?? slug;
  const existing = ((await db.collection(COLLECTION).doc(existingDocId).get()).data() as
    | DelegacionDocument
    | undefined);

  const doc: DelegacionDocument = {
    slug,
    nombre: input.nombre.trim(),
    provincia: input.provincia.trim(),
    delegados: input.delegados,
    webUrl: normalizeUrl(input.webUrl),
    facebookUrl: normalizeUrl(input.facebookUrl),
    instagramUrl: normalizeUrl(input.instagramUrl),
    twitterUrl: normalizeUrl(input.twitterUrl),
    email: normalizeUrl(input.email),
    telefono: normalizeUrl(input.telefono),
    direccion: normalizeUrl(input.direccion),
    orden: input.orden ?? 0,
    status: input.status,
    createdAt: existing?.createdAt ?? now,
    modifiedAt: now,
  };

  await db.collection(COLLECTION).doc(slug).set(doc);
  return doc;
}

export async function deleteDelegacion(slug: string): Promise<void> {
  await dbOrThrow().collection(COLLECTION).doc(slug).delete();
}

export function groupDelegacionesByProvincia(
  delegaciones: DelegacionDocument[]
): { provincia: string; delegaciones: DelegacionDocument[] }[] {
  const map = new Map<string, DelegacionDocument[]>();

  for (const delegacion of delegaciones) {
    const key = delegacion.provincia.trim() || 'Sin provincia';
    const list = map.get(key) ?? [];
    list.push(delegacion);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([provincia, items]) => ({
      provincia,
      delegaciones: sortDelegaciones(items),
    }));
}
