import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import { slugify } from '@/lib/slug';
import type {
  AccionColectivaDocument,
  AccionColectivaListItem,
  AccionColectivaStatus,
  AccionColectivaWithActualizaciones,
  ActualizacionDocument,
  ActualizacionSource,
  ActualizacionStatus,
  AccionColectivaAuthor,
  ExpedientePdf,
  ExpedientePasoExtraido,
} from '@/types/acciones-colectivas';

const COLLECTION = 'acciones_colectivas';
const UPDATES_SUB = 'actualizaciones';

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');
  return db;
}

function updatesRef(slug: string) {
  return dbOrThrow().collection(COLLECTION).doc(slug).collection(UPDATES_SUB);
}

export async function uniqueAccionSlug(base: string, excludeSlug?: string): Promise<string> {
  const db = dbOrThrow();
  let slug = slugify(base) || 'accion-colectiva';
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

function toListItem(data: AccionColectivaDocument): AccionColectivaListItem {
  return {
    slug: data.slug,
    title: data.title,
    status: data.status,
    lastUpdateAt: data.lastUpdateAt,
    updateCount: data.updateCount,
    modifiedAt: data.modifiedAt,
  };
}

export async function listAccionesColectivasAdmin(): Promise<AccionColectivaListItem[]> {
  const db = dbOrThrow();
  const snap = await db.collection(COLLECTION).orderBy('modifiedAt', 'desc').get();
  return snap.docs.map((doc) => toListItem(doc.data() as AccionColectivaDocument));
}

export async function listAccionesColectivasPublic(): Promise<AccionColectivaListItem[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection(COLLECTION)
    .where('status', '==', 'publish')
    .orderBy('lastUpdateAt', 'desc')
    .get();
  return snap.docs.map((doc) => toListItem(doc.data() as AccionColectivaDocument));
}

export async function getAccionColectiva(
  slug: string
): Promise<AccionColectivaDocument | null> {
  const snap = await dbOrThrow().collection(COLLECTION).doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as AccionColectivaDocument;
}

export async function listActualizaciones(
  slug: string,
  options: { includeDrafts?: boolean } = {}
): Promise<ActualizacionDocument[]> {
  const ref = updatesRef(slug);
  const snap = options.includeDrafts
    ? await ref.orderBy('publishedAt', 'desc').get()
    : await ref
        .where('status', '==', 'publish')
        .orderBy('publishedAt', 'desc')
        .get();

  return snap.docs.map((doc) => doc.data() as ActualizacionDocument);
}

export async function getAccionColectivaWithActualizaciones(
  slug: string,
  options: { includeDrafts?: boolean } = {}
): Promise<AccionColectivaWithActualizaciones | null> {
  const accion = await getAccionColectiva(slug);
  if (!accion) return null;
  const actualizaciones = await listActualizaciones(slug, options);
  return { ...accion, actualizaciones };
}

export async function saveAccionColectiva(input: {
  slug?: string;
  title: string;
  summary?: string;
  status: AccionColectivaStatus;
  existingSlug?: string;
}): Promise<AccionColectivaDocument> {
  const db = dbOrThrow();
  const now = new Date().toISOString();
  const slug = input.existingSlug
    ? input.existingSlug
    : await uniqueAccionSlug(input.slug || input.title);

  const existing = input.existingSlug
    ? ((await db.collection(COLLECTION).doc(slug).get()).data() as
        | AccionColectivaDocument
        | undefined)
    : undefined;

  const doc: AccionColectivaDocument = {
    slug,
    title: input.title.trim(),
    summary: (input.summary ?? '').trim(),
    status: input.status,
    createdAt: existing?.createdAt ?? now,
    modifiedAt: now,
    lastUpdateAt: existing?.lastUpdateAt ?? now,
    updateCount: existing?.updateCount ?? 0,
    expedientePdf: existing?.expedientePdf ?? null,
  };

  await db.collection(COLLECTION).doc(slug).set(doc);
  return doc;
}

async function refreshAccionUpdateMeta(slug: string): Promise<void> {
  const db = dbOrThrow();
  const snap = await updatesRef(slug)
    .where('status', '==', 'publish')
    .orderBy('publishedAt', 'desc')
    .limit(1)
    .get();

  const countSnap = await updatesRef(slug).where('status', '==', 'publish').get();

  await db.collection(COLLECTION).doc(slug).update({
    lastUpdateAt: snap.empty ? null : snap.docs[0].data().publishedAt,
    updateCount: countSnap.size,
    modifiedAt: new Date().toISOString(),
  });
}

export async function setExpedientePdf(slug: string, expedientePdf: ExpedientePdf): Promise<void> {
  const db = dbOrThrow();
  await db.collection(COLLECTION).doc(slug).update({
    expedientePdf,
    modifiedAt: new Date().toISOString(),
  });
}

export async function addActualizacion(
  slug: string,
  input: {
    title?: string;
    body: string;
    status: ActualizacionStatus;
    publishedAt?: string;
    source?: ActualizacionSource;
  },
  author: AccionColectivaAuthor
): Promise<ActualizacionDocument> {
  const accion = await getAccionColectiva(slug);
  if (!accion) throw new Error('Acción colectiva no encontrada.');

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const publishedAt = input.publishedAt || now;

  const doc: ActualizacionDocument = {
    id,
    title: (input.title ?? '').trim(),
    body: input.body.trim(),
    status: input.status,
    source: input.source ?? 'manual',
    publishedAt,
    createdAt: now,
    modifiedAt: now,
    author,
  };

  await updatesRef(slug).doc(id).set(doc);
  await refreshAccionUpdateMeta(slug);
  return doc;
}

export async function importActualizacionesFromExpediente(
  slug: string,
  pasos: ExpedientePasoExtraido[],
  author: AccionColectivaAuthor
): Promise<ActualizacionDocument[]> {
  const accion = await getAccionColectiva(slug);
  if (!accion) throw new Error('Acción colectiva no encontrada.');
  if (!pasos.length) throw new Error('No hay pasos para importar.');

  const db = dbOrThrow();
  const batch = db.batch();
  const now = new Date().toISOString();
  const created: ActualizacionDocument[] = [];

  for (const paso of pasos) {
    const id = crypto.randomUUID();
    const doc: ActualizacionDocument = {
      id,
      title: paso.titulo.trim(),
      body: paso.descripcion.trim(),
      status: 'publish',
      source: 'ai',
      publishedAt: paso.fecha,
      createdAt: now,
      modifiedAt: now,
      author,
    };
    batch.set(updatesRef(slug).doc(id), doc);
    created.push(doc);
  }

  await batch.commit();
  await refreshAccionUpdateMeta(slug);
  return created;
}

export async function updateActualizacion(
  slug: string,
  id: string,
  input: Partial<{
    title: string;
    body: string;
    status: ActualizacionStatus;
    publishedAt: string;
  }>
): Promise<ActualizacionDocument> {
  const ref = updatesRef(slug).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Actualización no encontrada.');

  const existing = snap.data() as ActualizacionDocument;
  const now = new Date().toISOString();

  const updated: ActualizacionDocument = {
    ...existing,
    title: input.title !== undefined ? input.title.trim() : existing.title,
    body: input.body !== undefined ? input.body.trim() : existing.body,
    status: input.status ?? existing.status,
    publishedAt: input.publishedAt ?? existing.publishedAt,
    modifiedAt: now,
    source: existing.source ?? 'manual',
  };

  await ref.set(updated);
  await refreshAccionUpdateMeta(slug);
  return updated;
}

export async function deleteActualizacion(slug: string, id: string): Promise<void> {
  const ref = updatesRef(slug).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Actualización no encontrada.');
  await ref.delete();
  await refreshAccionUpdateMeta(slug);
}

export async function deleteAccionColectiva(slug: string): Promise<void> {
  const db = dbOrThrow();
  const updatesSnap = await updatesRef(slug).get();
  const batch = db.batch();
  updatesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(db.collection(COLLECTION).doc(slug));
  await batch.commit();
}
