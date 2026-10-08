import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import {
  distinctiveEmpresaTokens,
  matchesEmpresaQuery,
  normalizeSearchText,
  sanitizeSearchKeywords,
} from '@/lib/reclamos-search-match';
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

function toDatePrefix(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    const withToDate = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof withToDate.toDate === 'function') {
      try {
        return withToDate.toDate().toISOString().slice(0, 10);
      } catch {
        return '';
      }
    }
    const seconds = withToDate.seconds ?? withToDate._seconds;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000).toISOString().slice(0, 10);
    }
  }
  return '';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function buildSearchIndexDoc(reclamo: StoredReclamoDocument): ReclamoSearchIndexDoc {
  const empresaNombres = [
    ...reclamo.empresas.map((e) => e.nombre.trim()),
    ...(reclamo.otrasEmpresas ? [reclamo.otrasEmpresas.trim()] : []),
  ].filter(Boolean);

  const causaTextos = (reclamo.causas ?? [])
    .map((c) => String(c.descripcion ?? '').trim())
    .filter(Boolean);
  const hechoPreview = String(reclamo.hecho ?? '').trim().slice(0, HECHO_PREVIEW_LEN);
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
    `Registrado: ${toDatePrefix(reclamo.createdAt) || '—'}`,
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
    createdAt: toDatePrefix(reclamo.createdAt) || (typeof reclamo.createdAt === 'string' ? reclamo.createdAt : ''),
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

  // Solo estrechar por ID cuando no hay texto libre: muchos reclamos cargan la
  // empresa en "otras empresas" / con typos y no tienen el empresaId de catálogo.
  if (filters.empresaId && !filters.empresaQuery) {
    const snap = await db
      .collection(COLLECTION)
      .where('empresaIds', 'array-contains', filters.empresaId)
      .get();
    return snap.docs.map((doc) => doc.data() as ReclamoSearchIndexDoc);
  }

  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map((doc) => doc.data() as ReclamoSearchIndexDoc);
}

function matchesKeywords(textoSearch: string | undefined, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const haystack = textoSearch ?? '';
  return keywords.every((kw) => haystack.includes(normalizeSearchText(kw)));
}

function matchesEmpresaFilter(doc: ReclamoSearchIndexDoc, filters: ReclamoSearchFilters): boolean {
  const byId =
    filters.empresaId != null && Array.isArray(doc.empresaIds) && doc.empresaIds.includes(filters.empresaId);
  const byQuery = filters.empresaQuery
    ? matchesEmpresaQuery(doc.empresaSearch ?? '', filters.empresaQuery)
    : false;

  if (filters.empresaId != null && filters.empresaQuery) return byId || byQuery;
  if (filters.empresaId != null) return byId;
  if (filters.empresaQuery) return byQuery;
  return true;
}

function matchesDateRange(createdAt: unknown, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  const date = toDatePrefix(createdAt);
  if (!date) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function matchesCausaKeywords(causaTextos: string[] | undefined, keywords?: string[]): boolean {
  if (!keywords?.length) return true;
  const blob = normalizeSearchText((causaTextos ?? []).join(' '));
  return keywords.some((kw) => blob.includes(normalizeSearchText(kw)));
}

function matchesCausaIds(causaIds: number[] | undefined, required?: number[]): boolean {
  if (!required?.length) return true;
  const ids = Array.isArray(causaIds) ? causaIds : [];
  return required.some((id) => ids.includes(id));
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

    const d = toDatePrefix(hit.createdAt);
    if (!d) continue;
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
    resumen: doc.resumen ?? '',
    empresaNombres: Array.isArray(doc.empresaNombres) ? doc.empresaNombres : [],
    causaTextos: Array.isArray(doc.causaTextos) ? doc.causaTextos : [],
    estadoDescripcion: doc.estadoDescripcion ?? 'Consulta',
    idGrupoEstado: doc.idGrupoEstado,
    provinciaNombre: doc.provinciaNombre,
    createdAt: toDatePrefix(doc.createdAt) || (typeof doc.createdAt === 'string' ? doc.createdAt : ''),
    anonPreview: doc.anonPreview ?? '',
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
    if (!matchesEmpresaFilter(doc, filters)) return false;
    if (!matchesKeywords(doc.textoSearch, filters.keywords ?? [])) return false;
    if (!matchesCausaIds(doc.causaIds, filters.causaIds)) return false;
    if (!matchesCausaKeywords(doc.causaTextos, filters.causaKeywords)) return false;
    if (!matchesDateRange(doc.createdAt, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });

  filtered.sort((a, b) => toDatePrefix(b.createdAt).localeCompare(toDatePrefix(a.createdAt)));
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

  const distinctive = distinctiveEmpresaTokens(normalized);
  // Sin marca (solo "ahorro para fines") no resolvemos un ID: sería una administradora al azar.
  if (distinctive.length === 0) return null;

  const snap = await db.collection('reclamos_empresas').get();
  let best: { id: number; score: number } | null = null;

  for (const doc of snap.docs) {
    const data = doc.data() as { id?: number; nombreSearch?: string; nombre?: string };
    if (!data.id) continue;
    const name = normalizeSearchText(data.nombreSearch || data.nombre || '');
    if (!name) continue;
    if (!matchesEmpresaQuery(name, normalized)) continue;

    if (name === normalized) return data.id;

    let score = 0;
    if (name.startsWith(normalized) || normalized.startsWith(name)) score = 4;
    else if (distinctive.every((token) => name.includes(token))) score = 3;
    else if (name.includes(normalized) || normalized.includes(name)) score = 2;
    else score = 1;

    if (!best || score > best.score) {
      best = { id: data.id, score };
    }
  }

  return best?.id ?? null;
}

export async function mergeParsedFilters(
  parsed: ReclamoSearchFilters,
  manual?: Partial<ReclamoSearchFilters>
): Promise<ReclamoSearchFilters> {
  const merged: ReclamoSearchFilters = {
    ...parsed,
    ...manual,
    keywords: [...asStringArray(parsed.keywords), ...asStringArray(manual?.keywords)],
    causaKeywords: [...asStringArray(parsed.causaKeywords), ...asStringArray(manual?.causaKeywords)],
    causaIds: manual?.causaIds?.length ? manual.causaIds : parsed.causaIds,
  };

  if (merged.empresaQuery) {
    const distinctive = distinctiveEmpresaTokens(merged.empresaQuery);
    if (distinctive.length) merged.empresaQuery = distinctive.join(' ');
  }

  if (manual?.empresaId) {
    merged.empresaId = manual.empresaId;
    if (!manual.empresaQuery) merged.empresaQuery = undefined;
  } else if (merged.empresaQuery && !merged.empresaId) {
    const id = await resolveEmpresaIdByName(merged.empresaQuery);
    if (id) {
      // Conservar empresaQuery: el ID de catálogo suma hits, no reemplaza el texto libre.
      merged.empresaId = id;
    }
  }

  merged.keywords = sanitizeSearchKeywords(merged.keywords, merged.empresaQuery);
  merged.causaKeywords = sanitizeSearchKeywords(merged.causaKeywords, merged.empresaQuery);

  return merged;
}
