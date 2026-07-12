import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import { computeAdminBandeja, RECLAMO_ESTADO_CONSULTA } from '@/lib/reclamos-admin';
import { RECLAMO_GRUPO_JUDICIAL } from '@/lib/reclamos-display';
import {
  getCausasParaEstadisticas,
  loadReclamoCausasValidationMaps,
} from '@/lib/reclamos-causas-validate';
import {
  getReclamoCausasFromFirestore,
  getReclamoEstadosFromFirestore,
  getReclamoProvinciasFromFirestore,
} from '@/lib/reclamos-store';
import type { ReclamoAdminBandeja, StoredReclamoDocument } from '@/types/reclamos';
import type {
  EmpresaCausaCombo,
  RankedCount,
  ReclamoEstadisticas,
  ReclamoEstadisticasFilters,
  ReclamoEstadisticasFiltrosCatalogos,
  ResponsableOption,
} from '@/types/reclamos-stats';

const TOP_LIMIT = 15;
const EMPRESA_CAUSA_LIMIT = 30;

function grupoLabel(idGrupoEstado?: number): string {
  if (idGrupoEstado === 3) return 'Archivados';
  if (idGrupoEstado === 2) return 'En trámite';
  return 'Activos';
}

function bandejaLabel(bandeja: ReclamoAdminBandeja): string {
  if (bandeja === 'recibidos') return 'Recibidos';
  if (bandeja === 'archivados') return 'Archivados';
  return 'En gestión';
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function yearKey(iso: string): string {
  return iso.slice(0, 4);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function increment(map: Record<string, number>, key: string, amount = 1): void {
  map[key] = (map[key] ?? 0) + amount;
}

function toRanked(map: Record<string, number>, limit = TOP_LIMIT): RankedCount[] {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
    .slice(0, limit);
}

function toRankedWithId(
  map: Map<number, { id: number; label: string; count: number }>,
  limit = TOP_LIMIT
): RankedCount[] {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
    .slice(0, limit)
    .map(({ id, label, count }) => ({ id, label, count }));
}

function matchesFilters(
  data: StoredReclamoDocument,
  bandeja: ReclamoAdminBandeja,
  filters: ReclamoEstadisticasFilters,
  maps: Awaited<ReturnType<typeof loadReclamoCausasValidationMaps>>
): boolean {
  const createdDate = data.createdAt.slice(0, 10);
  if (filters.dateFrom && createdDate < filters.dateFrom) return false;
  if (filters.dateTo && createdDate > filters.dateTo) return false;
  if (filters.idGrupoEstado != null && data.idGrupoEstado !== filters.idGrupoEstado) return false;
  if (filters.bandeja && filters.bandeja !== bandeja) return false;
  if (filters.idCasoEstado != null && data.idCasoEstado !== filters.idCasoEstado) return false;

  if (filters.empresaId != null) {
    const ids = data.empresaIds ?? data.empresas?.map((e) => e.id) ?? [];
    if (!ids.includes(filters.empresaId)) return false;
  }

  if (filters.causaId != null) {
    const causasValidas = getCausasParaEstadisticas(data, maps);
    const ids = causasValidas.map((c) => c.id);
    if (!ids.includes(filters.causaId)) return false;
  }

  if (filters.provinciaId != null && data.denunciante.provinciaId !== filters.provinciaId) {
    return false;
  }

  if (filters.responsableEmail) {
    const email = data.responsable?.email?.trim().toLowerCase();
    if (email !== filters.responsableEmail.trim().toLowerCase()) return false;
  }

  if (filters.sinResponsable && data.responsable) return false;
  if (filters.sinAsignar) {
    if (data.responsable || data.idCasoEstado !== RECLAMO_ESTADO_CONSULTA) return false;
  }

  if (filters.enJuicio && data.idGrupoEstado !== RECLAMO_GRUPO_JUDICIAL) return false;
  if (filters.conExpediente && !data.numeroExpediente?.trim()) return false;

  const comms = data.comunicaciones?.length ?? 0;
  if (filters.conComunicaciones && comms === 0) return false;
  if (filters.esExterno && !data.esExterno) return false;

  return true;
}

export async function getReclamoEstadisticasFiltrosCatalogos(): Promise<ReclamoEstadisticasFiltrosCatalogos> {
  const [causas, estados, provincias] = await Promise.all([
    getReclamoCausasFromFirestore(),
    getReclamoEstadosFromFirestore(),
    getReclamoProvinciasFromFirestore(),
  ]);

  return {
    causas: causas
      .filter((c) => c.activo)
      .map((c) => ({ id: c.id, descripcion: c.descripcion })),
    estados: estados
      .filter((e) => e.activo)
      .map((e) => ({ id: e.id, descripcion: e.descripcion, idGrupoEstado: e.idGrupoEstado })),
    provincias: provincias
      .filter((p) => p.activo)
      .map((p) => ({ id: p.id, nombre: p.nombre })),
  };
}

export async function computeReclamoEstadisticas(
  filters: ReclamoEstadisticasFilters = {}
): Promise<ReclamoEstadisticas> {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');

  const snap = await db.collection('reclamos').get();
  const validationMaps = await loadReclamoCausasValidationMaps();
  const tieneMapaRubros = validationMaps.causaIdsByRubro.size > 0;
  const nowIso = new Date().toISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

  const porEstado: Record<string, number> = {};
  const porGrupo: Record<string, number> = {};
  const porBandeja: Record<string, number> = {};
  const porResponsable: Record<string, number> = {};
  const porProvincia: Record<string, number> = {};
  const porCiudad: Record<string, number> = {};
  const porMes: Record<string, number> = {};
  const porAnio: Record<string, number> = {};
  const porEmpresa = new Map<number, { id: number; label: string; count: number }>();
  const porCausa = new Map<number, { id: number; label: string; count: number }>();
  const combosEmpresaCausa = new Map<string, EmpresaCausaCombo>();
  const responsablesMap = new Map<string, ResponsableOption>();

  let total = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let sinAsignar = 0;
  let sinResponsable = 0;
  let enJuicio = 0;
  let conExpediente = 0;
  let conComunicaciones = 0;
  let conComunicacionesIA = 0;
  let conComentarios = 0;
  let nuevosUltimos30Dias = 0;
  let actualizadosUltimos30Dias = 0;
  let esExterno = 0;
  let conCausas = 0;
  let sinCausas = 0;
  let reclamosUnaEmpresa = 0;
  let reclamosMultiEmpresa = 0;
  let causasIncompatiblesRubro = 0;
  let totalComentarios = 0;
  let totalComunicaciones = 0;
  let sumDiasAsignacion = 0;
  let countAsignacion = 0;
  let sumDiasDesdeCreacion = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as StoredReclamoDocument;
    if (data.deletedAt) continue;

    const bandeja = data.adminBandeja ?? computeAdminBandeja(data);
    if (!matchesFilters(data, bandeja, filters, validationMaps)) continue;

    const causas = tieneMapaRubros
      ? getCausasParaEstadisticas(data, validationMaps)
      : (data.causas ?? []);
    const causasRaw = data.causas ?? [];
    if (tieneMapaRubros && causasRaw.length > causas.length) {
      causasIncompatiblesRubro += causasRaw.length - causas.length;
    }

    total += 1;
    const createdDate = data.createdAt.slice(0, 10);
    if (!minDate || createdDate < minDate) minDate = createdDate;
    if (!maxDate || createdDate > maxDate) maxDate = createdDate;

    increment(porEstado, data.estadoDescripcion?.trim() || `Estado ${data.idCasoEstado}`);
    increment(porGrupo, grupoLabel(data.idGrupoEstado));
    increment(porBandeja, bandejaLabel(bandeja));
    increment(porMes, monthKey(data.createdAt));
    increment(porAnio, yearKey(data.createdAt));

    const provincia = data.denunciante.provinciaNombre?.trim();
    if (provincia) increment(porProvincia, provincia);

    const ciudad = data.denunciante.ciudadNombre?.trim();
    if (ciudad) {
      const ciudadKey = provincia ? `${ciudad} (${provincia})` : ciudad;
      increment(porCiudad, ciudadKey);
    }

    if (data.responsable?.email) {
      const key = data.responsable.name?.trim() || data.responsable.email;
      increment(porResponsable, key);

      const emailKey = data.responsable.email.trim().toLowerCase();
      const existing = responsablesMap.get(emailKey);
      if (existing) {
        existing.count += 1;
      } else {
        responsablesMap.set(emailKey, {
          email: data.responsable.email,
          name: data.responsable.name?.trim() || data.responsable.email,
          count: 1,
        });
      }

      if (data.responsable.assignedAt) {
        sumDiasAsignacion += daysBetween(data.responsable.assignedAt, nowIso);
        countAsignacion += 1;
      }
    } else {
      sinResponsable += 1;
      if (data.idCasoEstado === RECLAMO_ESTADO_CONSULTA) sinAsignar += 1;
    }

    const empresas = data.empresas ?? [];
    if (empresas.length === 1) {
      reclamosUnaEmpresa += 1;
    } else if (empresas.length > 1) {
      reclamosMultiEmpresa += 1;
    }

    for (const empresa of empresas) {
      const existing = porEmpresa.get(empresa.id);
      if (existing) {
        existing.count += 1;
      } else {
        porEmpresa.set(empresa.id, {
          id: empresa.id,
          label: empresa.nombre?.trim() || `Empresa ${empresa.id}`,
          count: 1,
        });
      }
    }

    if (causas.length) {
      conCausas += 1;
    } else {
      sinCausas += 1;
    }

    for (const causa of causas) {
      const existing = porCausa.get(causa.id);
      const label = causa.descripcion?.trim() || `Causa ${causa.id}`;
      if (existing) {
        existing.count += 1;
      } else {
        porCausa.set(causa.id, { id: causa.id, label, count: 1 });
      }
    }

    // Las causas están a nivel reclamo (tabla reclamos_causas en SQL), no por empresa.
    // Si hay varias empresas denunciadas en un mismo caso, no podemos saber qué causa
    // corresponde a cuál — solo contamos combos cuando hay exactamente una empresa.
    if (empresas.length === 1 && causas.length) {
      const empresa = empresas[0];
      for (const causa of causas) {
        const comboKey = `${empresa.id}:${causa.id}`;
        const existing = combosEmpresaCausa.get(comboKey);
        if (existing) {
          existing.count += 1;
        } else {
          combosEmpresaCausa.set(comboKey, {
            empresaId: empresa.id,
            empresaNombre: empresa.nombre?.trim() || `Empresa ${empresa.id}`,
            causaId: causa.id,
            causaDescripcion: causa.descripcion?.trim() || `Causa ${causa.id}`,
            count: 1,
            ejemploReclamoId: data.id,
          });
        }
      }
    }

    if (data.idGrupoEstado === RECLAMO_GRUPO_JUDICIAL) enJuicio += 1;
    if (data.numeroExpediente?.trim()) conExpediente += 1;

    const comms = data.comunicaciones?.length ?? 0;
    if (comms > 0) {
      conComunicaciones += 1;
      totalComunicaciones += comms;
      if (data.comunicaciones?.some((c) => c.viaIA)) conComunicacionesIA += 1;
    }

    const comments = data.comentarios?.length ?? 0;
    if (comments > 0) {
      conComentarios += 1;
      totalComentarios += comments;
    }

    if (data.createdAt >= thirtyDaysAgoIso) nuevosUltimos30Dias += 1;
    if (data.updatedAt >= thirtyDaysAgoIso) actualizadosUltimos30Dias += 1;
    if (data.esExterno) esExterno += 1;

    sumDiasDesdeCreacion += daysBetween(data.createdAt, nowIso);
  }

  const recibidos = porBandeja['Recibidos'] ?? 0;
  const archivados = porBandeja['Archivados'] ?? 0;
  const enGestion = porBandeja['En gestión'] ?? 0;

  const porMesSorted = toRanked(porMes, 36).sort((a, b) => a.label.localeCompare(b.label));
  const porAnioSorted = toRanked(porAnio, 20).sort((a, b) => a.label.localeCompare(b.label));

  const combosSorted = [...combosEmpresaCausa.values()]
    .sort((a, b) => b.count - a.count || a.empresaNombre.localeCompare(b.empresaNombre, 'es'))
    .slice(0, EMPRESA_CAUSA_LIMIT);

  const responsablesDisponibles = [...responsablesMap.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')
  );

  return {
    total,
    computedAt: nowIso,
    filtersApplied: filters,
    rangoFechas: { desde: minDate, hasta: maxDate },
    resumen: {
      recibidos,
      enGestion,
      archivados,
      sinAsignar,
      enJuicio,
      conExpediente,
      conComunicaciones,
      conComunicacionesIA,
      conComentarios,
      nuevosUltimos30Dias,
      actualizadosUltimos30Dias,
      esExterno,
      promedioComentarios: total > 0 ? Math.round((totalComentarios / total) * 10) / 10 : 0,
      promedioComunicaciones: total > 0 ? Math.round((totalComunicaciones / total) * 10) / 10 : 0,
      conCausas,
      sinCausas,
      empresasDistintas: porEmpresa.size,
      causasDistintas: porCausa.size,
      reclamosUnaEmpresa,
      reclamosMultiEmpresa,
      causasIncompatiblesRubro,
      usaValidacionRubros: tieneMapaRubros,
    },
    porEstado: toRanked(porEstado, 30),
    porGrupo: toRanked(porGrupo, 10),
    porBandeja: toRanked(porBandeja, 5),
    porResponsable: toRanked(porResponsable, 20),
    sinResponsable,
    responsablesDisponibles,
    porProvincia: toRanked(porProvincia, 24),
    porCiudad: toRanked(porCiudad, 15),
    porMes: porMesSorted,
    porAnio: porAnioSorted,
    porEmpresa: toRankedWithId(porEmpresa, 50),
    porCausa: toRankedWithId(porCausa, 50),
    combosEmpresaCausa: combosSorted,
    tiempoPromedioAsignacionDias:
      countAsignacion > 0 ? Math.round(sumDiasAsignacion / countAsignacion) : null,
    tiempoPromedioDesdeCreacionDias: total > 0 ? Math.round(sumDiasDesdeCreacion / total) : null,
  };
}
