import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import type { ReclamoCausaRef, StoredReclamoDocument } from '@/types/reclamos';

export type CausaRubroPair = { causaId: number; rubroId: number };
export type EmpresaRubroEntry = { empresaId: number; rubroId: number; rubroNombre?: string };

export type ReclamoCausasValidationMaps = {
  causaIdsByRubro: Map<number, Set<number>>;
  rubroIdsByEmpresa: Map<number, number[]>;
  activeCausaIds: Set<number>;
};

export type ReclamoCausasValidation = {
  validas: ReclamoCausaRef[];
  incompatibles: ReclamoCausaRef[];
  huerfanas: ReclamoCausaRef[];
  sinRubroEmpresa: boolean;
  rubroIds: number[];
};

let mapsCache: ReclamoCausasValidationMaps | null = null;
let mapsCacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');
  return db;
}

function buildCausaIdsByRubro(pairs: CausaRubroPair[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const { causaId, rubroId } of pairs) {
    const set = map.get(rubroId) ?? new Set<number>();
    set.add(causaId);
    map.set(rubroId, set);
  }
  return map;
}

function buildRubroIdsByEmpresa(entries: EmpresaRubroEntry[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const { empresaId, rubroId } of entries) {
    const list = map.get(empresaId) ?? [];
    if (!list.includes(rubroId)) list.push(rubroId);
    map.set(empresaId, list);
  }
  return map;
}

export async function loadReclamoCausasValidationMaps(): Promise<ReclamoCausasValidationMaps> {
  const now = Date.now();
  if (mapsCache && now - mapsCacheAt < CACHE_MS) return mapsCache;

  const db = dbOrThrow();
  const [metaSnap, causasSnap] = await Promise.all([
    db.collection('migration_meta').doc('reclamos_causas_rubros').get(),
    db.collection('reclamos_causas').get(),
  ]);

  const meta = metaSnap.data() as
    | {
        causaRubroPairs?: CausaRubroPair[];
        empresaRubroEntries?: EmpresaRubroEntry[];
      }
    | undefined;

  const activeCausaIds = new Set<number>();
  for (const doc of causasSnap.docs) {
    const data = doc.data() as { id?: number; activo?: boolean };
    if (data.id != null && data.activo !== false) activeCausaIds.add(data.id);
  }

  const maps: ReclamoCausasValidationMaps = {
    causaIdsByRubro: buildCausaIdsByRubro(meta?.causaRubroPairs ?? []),
    rubroIdsByEmpresa: buildRubroIdsByEmpresa(meta?.empresaRubroEntries ?? []),
    activeCausaIds,
  };

  mapsCache = maps;
  mapsCacheAt = now;
  return maps;
}

export function resolveEmpresaRubroIds(
  reclamo: Pick<StoredReclamoDocument, 'empresas' | 'empresaIds'>,
  maps: ReclamoCausasValidationMaps
): { rubroIds: number[]; sinRubroEmpresa: boolean } {
  const empresaIds = reclamo.empresaIds?.length
    ? reclamo.empresaIds
    : (reclamo.empresas ?? []).map((e) => e.id);

  const rubroSet = new Set<number>();
  for (const empresaId of empresaIds) {
    for (const rubroId of maps.rubroIdsByEmpresa.get(empresaId) ?? []) {
      rubroSet.add(rubroId);
    }
  }

  return {
    rubroIds: [...rubroSet],
    sinRubroEmpresa: empresaIds.length > 0 && rubroSet.size === 0,
  };
}

export function isCausaCompatibleWithRubros(
  causaId: number,
  rubroIds: number[],
  maps: ReclamoCausasValidationMaps
): boolean {
  if (!rubroIds.length) return true;
  return rubroIds.some((rubroId) => maps.causaIdsByRubro.get(rubroId)?.has(causaId));
}

export function validateReclamoCausas(
  reclamo: Pick<StoredReclamoDocument, 'causas' | 'empresas' | 'empresaIds'>,
  maps: ReclamoCausasValidationMaps
): ReclamoCausasValidation {
  const causas = reclamo.causas ?? [];
  const { rubroIds, sinRubroEmpresa } = resolveEmpresaRubroIds(reclamo, maps);

  const validas: ReclamoCausaRef[] = [];
  const incompatibles: ReclamoCausaRef[] = [];
  const huerfanas: ReclamoCausaRef[] = [];

  for (const causa of causas) {
    if (!maps.activeCausaIds.has(causa.id)) {
      huerfanas.push(causa);
      continue;
    }
    if (sinRubroEmpresa || isCausaCompatibleWithRubros(causa.id, rubroIds, maps)) {
      validas.push(causa);
    } else {
      incompatibles.push(causa);
    }
  }

  return { validas, incompatibles, huerfanas, sinRubroEmpresa, rubroIds };
}

/** Causas a usar en estadísticas: solo las compatibles con el rubro de la empresa. */
export function getCausasParaEstadisticas(
  reclamo: Pick<StoredReclamoDocument, 'causas' | 'empresas' | 'empresaIds'>,
  maps: ReclamoCausasValidationMaps
): ReclamoCausaRef[] {
  return validateReclamoCausas(reclamo, maps).validas;
}
