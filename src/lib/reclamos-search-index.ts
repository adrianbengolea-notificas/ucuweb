import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import type { StoredReclamoDocument } from '@/types/reclamos';
import type {
  ReclamoSearchFilters,
  ReclamoSearchHit,
  ReclamoSearchIndexDoc,
  ReclamoSearchResult,
  ReclamoSearchStats,
} from '@/types/reclamos-search';

const COLLECTION = 'reclamos_busqueda';
const HECHO_PREVIEW_LEN = 400;

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');
  return db;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchIndexDoc(reclamo: StoredReclamoDocument): ReclamoSearchIndexDoc {
  const empresaNombres = [
    ...reclamo.empresas.map((e) => e.nombre.trim()),
    ...(reclamo.otrasEmpresas ? [reclamo.otrasEmpresas.trim()] : []),
  ].filter(Boolean);

  const causaTextos = (reclamo.causas ?? []).map((c) => c.descripcion.trim()).filter(Boolean);
  const hechoPreview = reclamo.hecho.trim().slice(0, HECHO_PREVIEW_LEN);
  const estadoDescripcion = reclamo.estadoDescripcion?.trim() ?? 'Consulta';

  const textoSearch = normalizeSearchText(
    [
      reclamo.resumen,
      reclamo.hecho,
      ...empresaNombres,
      ...causaTextos,
      estadoDescripcion,
      reclamo.denunciante.provinciaNombre,
      reclamo.denunciante.ciudadNombre,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const anonPreview = [
    `Reclamo #${reclamo.id}`,
    `Empresas: ${empresaNombres.join('; ') || '—'}`,
    `Estado: ${estadoDescripcion}`,
    `Resumen: ${reclamo.resumen}`,
    causaTextos.length ? `Causas: ${causaTextos.join('; ')}` : null,
    `Registrado: ${reclamo.createdAt.slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    id: reclamo.id,
    empresaIds: reclamo.empresaIds,
    empresaNombres,
    empresaSearch: normalizeSearchText(empresaNombres.join(' ')),
    causaIds: (reclamo.causas ?? []).map((c) => c.id),
    causaTextos,
    resumen: reclamo.resumen,
    hechoPreview,
    textoSearch,
    estadoDescripcion,
    idCasoEstado: reclamo.idCasoEstado,
    idGrupoEstado: reclamo.idGrupoEstado,
    provinciaNombre: reclamo.denunciante.provinciaNombre,
    ciudadNombre: reclamo.denunciante.ciudadNombre,
    createdAt: reclamo.createdAt,
    updatedAt: reclamo.updatedAt,
    anonPreview,
    indexedAt: new Date().toISOString(),
  };
}

export async function getSearchIndexMeta(): Promise<{
  indexedAt: string | null;
  count: number;
} | null> {
  try {
    const db = getAdminDb();
    if (!db) return null;
    const snap = await db.collection('migration_meta').doc('reclamos_search_index').get();
    if (!snap.exists) return { indexedAt: null, count: 0 };
    const data = snap.data();
    return {
      indexedAt: typeof data?.indexedAt === 'string' ? data.indexedAt : null,
      count: Number(data?.count ?? 0),
    };
  } catch {
    return null;
  }
}

async function loadIndexDocs(filters: ReclamoSearchFilters): Promise<ReclamoSearchIndexDoc[]> {
  const db = dbOrThrow();

  if (filters.empresaId) {
    const snap = await db
      .collection(COLLECTION)
      .where('empresaIds', 'array-contains', filters.empresaId)
      .get();
    return snap.docs.map((doc) => doc.data() as ReclamoSearchIndexDoc);
  }

  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map((doc) => doc.data() as ReclamoSearchIndexDoc);
}

function matchesKeywords(textoSearch: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  return keywords.every((kw) => textoSearch.includes(normalizeSearchText(kw)));
}

function matchesEmpresaQuery(empresaSearch: string, query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (!normalized) return true;
  return empresaSearch.includes(normalized);
}

function matchesDateRange(createdAt: string, dateFrom?: string, dateTo?: string): boolean {
  const date = createdAt.slice(0, 10);
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function matchesCausaKeywords(causaTextos: string[], keywords?: string[]): boolean {
  if (!keywords?.length) return true;
  const blob = normalizeSearchText(causaTextos.join(' '));
  return keywords.some((kw) => blob.includes(normalizeSearchText(kw)));
}

function computeStats(hits: ReclamoSearchHit[]): ReclamoSearchStats {
  const porEstado: Record<string, number> = {};
  const porGrupo: Record<string, number> = {};
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const hit of hits) {
    porEstado[hit.estadoDescripcion] = (porEstado[hit.estadoDescripcion] ?? 0) + 1;
    const grupo =
      hit.idGrupoEstado === 3 ? 'Archivados' : hit.idGrupoEstado === 2 ? 'En trámite' : 'Activos';
    porGrupo[grupo] = (porGrupo[grupo] ?? 0) + 1;

    const d = hit.createdAt.slice(0, 10);
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  return {
    total: hits.length,
    porEstado,
    porGrupo,
    rangoFechas: { desde: minDate, hasta: maxDate },
  };
}

function toHit(doc: ReclamoSearchIndexDoc): ReclamoSearchHit {
  return {
    id: doc.id,
    resumen: doc.resumen,
    empresaNombres: doc.empresaNombres,
    causaTextos: doc.causaTextos,
    estadoDescripcion: doc.estadoDescripcion,
    idGrupoEstado: doc.idGrupoEstado,
    provinciaNombre: doc.provinciaNombre,
    createdAt: doc.createdAt,
    anonPreview: doc.anonPreview,
  };
}

export async function searchReclamosIndex(
  filters: ReclamoSearchFilters,
  interpretacion?: string
): Promise<ReclamoSearchResult> {
  const docs = await loadIndexDocs(filters);

  const filtered = docs.filter((doc) => {
    if (filters.idGrupoEstado != null && doc.idGrupoEstado !== filters.idGrupoEstado) {
      return false;
    }
    if (filters.empresaQuery && !matchesEmpresaQuery(doc.empresaSearch, filters.empresaQuery)) {
      return false;
    }
    if (!matchesKeywords(doc.textoSearch, filters.keywords ?? [])) return false;
    if (!matchesCausaKeywords(doc.causaTextos, filters.causaKeywords)) return false;
    if (!matchesDateRange(doc.createdAt, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });

  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hits = filtered.map(toHit);

  return {
    hits,
    stats: computeStats(hits),
    filtersApplied: filters,
    interpretacion,
  };
}

export async function resolveEmpresaIdByName(query: string): Promise<number | null> {
  const db = dbOrThrow();
  const normalized = normalizeSearchText(query);
  if (normalized.length < 2) return null;

  const snap = await db
    .collection('reclamos_empresas')
    .orderBy('nombreSearch')
    .startAt(normalized)
    .endAt(`${normalized}\uf8ff`)
    .limit(1)
    .get();

  const first = snap.docs[0]?.data() as { id?: number; nombreSearch?: string } | undefined;
  if (!first?.id) return null;
  if (first.nombreSearch && !first.nombreSearch.includes(normalized.slice(0, 3))) return null;
  return first.id;
}

export async function mergeParsedFilters(
  parsed: ReclamoSearchFilters,
  manual?: Partial<ReclamoSearchFilters>
): Promise<ReclamoSearchFilters> {
  const merged: ReclamoSearchFilters = {
    ...parsed,
    ...manual,
    keywords: [...(parsed.keywords ?? []), ...(manual?.keywords ?? [])].filter(Boolean),
    causaKeywords: [...(parsed.causaKeywords ?? []), ...(manual?.causaKeywords ?? [])].filter(
      Boolean
    ),
  };

  if (manual?.empresaId) {
    merged.empresaId = manual.empresaId;
    merged.empresaQuery = undefined;
  } else if (merged.empresaQuery && !merged.empresaId) {
    const id = await resolveEmpresaIdByName(merged.empresaQuery);
    if (id) {
      merged.empresaId = id;
      merged.empresaQuery = undefined;
    }
  }

  return merged;
}
