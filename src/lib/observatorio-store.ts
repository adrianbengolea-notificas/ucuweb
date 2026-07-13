import 'server-only';

import { fixEncodingDeep } from '@/lib/fix-encoding';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  compareFallosByCreatedAtDesc,
  normalizeFalloDocument,
  repairStoredFalloDocument,
} from '@/lib/observatorio-normalize';
import type {
  CiudadOption,
  DivisaOption,
  EmpresaOption,
  EtiquetaOption,
  FalloDocument,
  FalloSearchParams,
  FallosResponse,
  JuzgadoOption,
  ObservatorioCatalogType,
  ProvinciaOption,
  ReclamoOption,
  RubroOption,
  StoredFalloDocument,
  TipoJuicioOption,
} from '@/types/observatorio';

const CATALOG_COLLECTIONS: Record<ObservatorioCatalogType, string> = {
  rubros: 'observatorio_rubros',
  provincias: 'observatorio_provincias',
  ciudades: 'observatorio_ciudades',
  juzgados: 'observatorio_juzgados',
  tipojuicio: 'observatorio_tipos_juicio',
  reclamos: 'observatorio_reclamos',
  etiquetas: 'observatorio_etiquetas',
  empresas: 'observatorio_empresas',
  divisas: 'observatorio_divisas',
};

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase Admin no configurado.');
  }
  return db;
}

export async function hasObservatorioInFirestore(): Promise<boolean> {
  try {
    const db = getAdminDb();
    if (!db) return false;
    const meta = await db.collection('migration_meta').doc('observatorio').get();
    return meta.exists;
  } catch {
    return false;
  }
}

function toFalloDocument(stored: StoredFalloDocument): FalloDocument {
  const { status: _status, actorSearch: _actorSearch, rubroIds: _rubroIds, causaIds: _causaIds, etiquetaIds: _etiquetaIds, demandadoEmpresaIds: _demandadoEmpresaIds, tipoJuicioId: _tipoJuicioId, provinciaId: _provinciaId, ciudadId: _ciudadId, juzgadoId: _juzgadoId, fechaSort: _fechaSort, ...fallo } = stored;
  return fixEncodingDeep(fallo);
}

function applyFilters(items: StoredFalloDocument[], params: FalloSearchParams): StoredFalloDocument[] {
  let filtered = items.filter((item) => !item.deletedAt);

  if (params.actor) {
    const query = params.actor.trim().toLowerCase();
    filtered = filtered.filter((item) => item.actorSearch.includes(query));
  }
  if (params.rubro?.length) {
    filtered = filtered.filter((item) =>
      params.rubro!.some((id) => item.rubroIds.includes(id))
    );
  }
  if (params.tipoJuicio) {
    filtered = filtered.filter((item) => item.tipoJuicioId === params.tipoJuicio);
  }
  if (params.causas?.length) {
    filtered = filtered.filter((item) =>
      params.causas!.some((id) => item.causaIds.includes(id))
    );
  }
  if (params.etiquetas?.length) {
    filtered = filtered.filter((item) =>
      params.etiquetas!.some((id) => item.etiquetaIds.includes(id))
    );
  }
  if (params.idProvincia) {
    filtered = filtered.filter((item) => item.provinciaId === params.idProvincia);
  }
  if (params.idCiudad) {
    filtered = filtered.filter((item) => item.ciudadId === params.idCiudad);
  }
  if (params.idTribunal) {
    filtered = filtered.filter((item) => item.juzgadoId === params.idTribunal);
  }
  if (params.demandado?.length) {
    filtered = filtered.filter((item) =>
      params.demandado!.some((id) => item.demandadoEmpresaIds.includes(id))
    );
  }

  return filtered;
}

export async function getFallosFromFirestore(
  params: FalloSearchParams = {}
): Promise<FallosResponse> {
  const db = dbOrThrow();
  // Se traen publicados y se ordenan por fecha de carga (createdAt), no por fecha de sentencia.
  const snap = await db.collection('fallos').where('status', '==', 'publish').get();

  const items = snap.docs.map((doc) => doc.data() as StoredFalloDocument);
  const filtered = applyFilters(items, params).sort(compareFallosByCreatedAtDesc);
  const offset = params.offset ?? 10;
  const page = params.page ?? 1;
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / offset));
  const data = filtered.slice((page - 1) * offset, page * offset).map(toFalloDocument);

  return {
    totalRows,
    totalPages,
    currentPage: page,
    data,
  };
}

export async function listAdminFallos(limit = 2000): Promise<StoredFalloDocument[]> {
  const db = dbOrThrow();
  const snap = await db.collection('fallos').get();
  return snap.docs
    .map((doc) => fixEncodingDeep(doc.data() as StoredFalloDocument))
    .filter((item) => !item.deletedAt)
    .sort(compareFallosByCreatedAtDesc)
    .slice(0, limit);
}

export async function getStoredFalloById(id: number): Promise<StoredFalloDocument | null> {
  const db = dbOrThrow();
  const doc = await db.collection('fallos').doc(String(id)).get();
  if (!doc.exists) return null;
  const fallo = repairStoredFalloDocument(doc.data() as StoredFalloDocument);
  return fallo.deletedAt ? null : fallo;
}

export async function getFalloByIdFromFirestore(id: number): Promise<FalloDocument | null> {
  const stored = await getStoredFalloById(id);
  return stored ? toFalloDocument(stored) : null;
}

export async function saveFalloDocument(fallo: StoredFalloDocument): Promise<void> {
  const db = dbOrThrow();
  await db.collection('fallos').doc(String(fallo.nroExpediente)).set(fallo);
}

export async function deleteFalloDocument(id: number): Promise<void> {
  const db = dbOrThrow();
  const ref = db.collection('fallos').doc(String(id));
  const doc = await ref.get();
  if (!doc.exists) return;
  const data = doc.data() as StoredFalloDocument;
  await ref.set({
    ...data,
    deletedAt: new Date().toLocaleDateString('es-AR'),
    status: 'draft',
    updatedAt: new Date().toLocaleDateString('es-AR'),
  });
}

export async function reserveNextExpediente(): Promise<number> {
  const db = dbOrThrow();
  const metaRef = db.collection('migration_meta').doc('observatorio');

  return db.runTransaction(async (transaction) => {
    const metaDoc = await transaction.get(metaRef);
    const current = metaDoc.data()?.nextExpediente ?? 3000;
    const next = Number(current) + 1;
    transaction.set(
      metaRef,
      {
        nextExpediente: next,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return next;
  });
}

async function readCatalog<T>(collection: string): Promise<T[]> {
  const db = dbOrThrow();
  const snap = await db.collection(collection).get();
  return snap.docs.map((doc) => fixEncodingDeep(doc.data() as T));
}

export async function getRubrosFromFirestore(): Promise<RubroOption[]> {
  const items = await readCatalog<{ id: number; rubro: string }>(CATALOG_COLLECTIONS.rubros);
  return items.sort((a, b) => a.rubro.localeCompare(b.rubro, 'es'));
}

export async function getProvinciasFromFirestore(): Promise<ProvinciaOption[]> {
  const items = await readCatalog<ProvinciaOption>(CATALOG_COLLECTIONS.provincias);
  return items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getCiudadesFromFirestore(idProvincia: number): Promise<CiudadOption[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection(CATALOG_COLLECTIONS.ciudades)
    .where('idProvincia', '==', idProvincia)
    .get();
  return snap.docs
    .map((doc) => fixEncodingDeep(doc.data() as CiudadOption))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getJuzgadosFromFirestore(idCiudad: number): Promise<JuzgadoOption[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection(CATALOG_COLLECTIONS.juzgados)
    .where('idCiudad', '==', idCiudad)
    .get();
  return snap.docs
    .map((doc) => fixEncodingDeep(doc.data() as JuzgadoOption))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getTiposJuicioFromFirestore(): Promise<TipoJuicioOption[]> {
  const items = await readCatalog<{ id: number; nombre?: string; description?: string }>(
    CATALOG_COLLECTIONS.tipojuicio
  );
  return items
    .map((item) => ({
      id: item.id,
      nombre: item.nombre ?? item.description ?? `Tipo ${item.id}`,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getReclamosFromFirestore(): Promise<ReclamoOption[]> {
  const items = await readCatalog<ReclamoOption>(CATALOG_COLLECTIONS.reclamos);
  return items.sort((a, b) => a.description.localeCompare(b.description, 'es'));
}

export async function getEtiquetasFromFirestore(): Promise<EtiquetaOption[]> {
  const items = await readCatalog<EtiquetaOption>(CATALOG_COLLECTIONS.etiquetas);
  return items.sort((a, b) => a.description.localeCompare(b.description, 'es'));
}

export async function getEmpresasFromFirestore(): Promise<EmpresaOption[]> {
  const items = await readCatalog<EmpresaOption>(CATALOG_COLLECTIONS.empresas);
  return items.sort((a, b) => a.razon_social.localeCompare(b.razon_social, 'es'));
}

export async function getDivisasFromFirestore(): Promise<DivisaOption[]> {
  const { ensureCanastaBasicaDivisa, DIVISA_CANASTA_CODIGO } = await import(
    '@/lib/observatorio-divisas'
  );
  const canasta = await ensureCanastaBasicaDivisa();

  const items = await readCatalog<{
    id: number;
    codigo?: string;
    nombre?: string;
    codigoDivisa?: string;
    nombreDivisa?: string;
    pais?: string;
  }>(CATALOG_COLLECTIONS.divisas);
  const mapped: DivisaOption[] = items.map((item) => ({
    id: item.id,
    codigo: item.codigo ?? item.codigoDivisa ?? '',
    nombre: item.nombre ?? item.nombreDivisa ?? '',
    pais: item.pais,
  }));

  if (!mapped.some((item) => item.codigo.toUpperCase() === DIVISA_CANASTA_CODIGO)) {
    mapped.push(canasta);
  }

  return mapped.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getNextCatalogId(type: ObservatorioCatalogType): Promise<number> {
  const db = dbOrThrow();
  const snap = await db
    .collection(CATALOG_COLLECTIONS[type])
    .orderBy('id', 'desc')
    .limit(1)
    .get();
  const max = snap.docs[0]?.data()?.id ?? 0;
  return Number(max) + 1;
}

export async function createEmpresaInFirestore(input: {
  razon_social: string;
  cuit?: string;
}): Promise<EmpresaOption> {
  const db = dbOrThrow();
  const id = await getNextCatalogId('empresas');
  const empresa: EmpresaOption = {
    id,
    razon_social: input.razon_social.trim(),
    cuit: input.cuit?.trim() || undefined,
  };
  await db.collection(CATALOG_COLLECTIONS.empresas).doc(String(id)).set(empresa);
  return empresa;
}

export async function createEtiquetaInFirestore(description: string): Promise<EtiquetaOption> {
  const db = dbOrThrow();
  const id = await getNextCatalogId('etiquetas');
  const etiqueta: EtiquetaOption = { id, description: description.trim() };
  await db.collection(CATALOG_COLLECTIONS.etiquetas).doc(String(id)).set(etiqueta);
  return etiqueta;
}

export async function upsertCatalogItems(
  type: ObservatorioCatalogType,
  items: Record<string, unknown>[]
): Promise<void> {
  const db = dbOrThrow();
  const collection = CATALOG_COLLECTIONS[type];
  const batchSize = 400;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = db.batch();
    for (const item of items.slice(index, index + batchSize)) {
      const id = String(item.id);
      batch.set(db.collection(collection).doc(id), item, { merge: true });
    }
    await batch.commit();
  }
}

export async function cacheJuzgados(items: JuzgadoOption[]): Promise<void> {
  if (!items.length) return;
  await upsertCatalogItems(
    'juzgados',
    items.map((item) => ({ ...item }))
  );
}

export function mapCatalogLookups(
  rubros: RubroOption[],
  reclamos: ReclamoOption[],
  etiquetas: EtiquetaOption[],
  tiposJuicio: TipoJuicioOption[],
  provincias: ProvinciaOption[],
  ciudades: CiudadOption[],
  juzgados: JuzgadoOption[],
  empresas: EmpresaOption[],
  divisas: DivisaOption[]
) {
  return {
    rubros: new Map(
      rubros.map((item) => [item.id, { id: item.id, nombre: item.rubro }])
    ),
    reclamos: new Map(
      reclamos.map((item) => [item.id, { id: item.id, nombre: item.description }])
    ),
    etiquetas: new Map(
      etiquetas.map((item) => [item.id, { id: item.id, nombre: item.description }])
    ),
    tiposJuicio: new Map(tiposJuicio.map((item) => [item.id, item])),
    provincias: new Map(provincias.map((item) => [item.id, item])),
    ciudades: new Map(ciudades.map((item) => [item.id, item])),
    juzgados: new Map(juzgados.map((item) => [item.id, item])),
    empresas: new Map(empresas.map((item) => [item.id, item])),
    divisas: new Map(divisas.map((item) => [item.id, item])),
  };
}

export async function loadCatalogLookupsForFallo(payload: {
  rubroIds: number[];
  causaIds: number[];
  etiquetaIds: number[];
  tipoJuicioId: number | null;
  provinciaId: number | null;
  ciudadId: number | null;
  juzgadoId: number | null;
  demandadoEmpresaIds: number[];
  actorEmpresaIds: number[];
  divisaId: number | null;
}) {
  const [
    rubros,
    reclamos,
    etiquetas,
    tiposJuicio,
    provincias,
    empresas,
    divisas,
  ] = await Promise.all([
    getRubrosFromFirestore(),
    getReclamosFromFirestore(),
    getEtiquetasFromFirestore(),
    getTiposJuicioFromFirestore(),
    getProvinciasFromFirestore(),
    getEmpresasFromFirestore(),
    getDivisasFromFirestore(),
  ]);

  const ciudades = payload.provinciaId
    ? await getCiudadesFromFirestore(payload.provinciaId)
    : [];
  const juzgados = payload.ciudadId
    ? await getJuzgadosFromFirestore(payload.ciudadId)
    : payload.juzgadoId
      ? [{ id: payload.juzgadoId, nombre: '' }]
      : [];

  return mapCatalogLookups(
    rubros,
    reclamos,
    etiquetas,
    tiposJuicio,
    provincias,
    ciudades,
    juzgados,
    empresas,
    divisas
  );
}

export { normalizeFalloDocument };
