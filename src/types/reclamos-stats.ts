import type { ReclamoAdminBandeja } from '@/types/reclamos';

export type ReclamoEstadisticasFilters = {
  dateFrom?: string;
  dateTo?: string;
  idGrupoEstado?: number;
  bandeja?: ReclamoAdminBandeja;
  empresaId?: number;
  causaId?: number;
  idCasoEstado?: number;
  provinciaId?: number;
  responsableEmail?: string;
  sinResponsable?: boolean;
  sinAsignar?: boolean;
  enJuicio?: boolean;
  conExpediente?: boolean;
  conComunicaciones?: boolean;
  esExterno?: boolean;
};

export type RankedCount = {
  label: string;
  count: number;
  id?: number;
};

export type EmpresaCausaCombo = {
  empresaId: number;
  empresaNombre: string;
  causaId: number;
  causaDescripcion: string;
  count: number;
  /** Primer reclamo donde aparece este par (para verificar en el detalle). */
  ejemploReclamoId?: number;
};

export type ResponsableOption = {
  email: string;
  name: string;
  count: number;
};

export type ReclamoEstadisticasResumen = {
  recibidos: number;
  enGestion: number;
  archivados: number;
  sinAsignar: number;
  enJuicio: number;
  conExpediente: number;
  conComunicaciones: number;
  conComunicacionesIA: number;
  conComentarios: number;
  nuevosUltimos30Dias: number;
  actualizadosUltimos30Dias: number;
  esExterno: number;
  promedioComentarios: number;
  promedioComunicaciones: number;
  conCausas: number;
  sinCausas: number;
  empresasDistintas: number;
  causasDistintas: number;
  reclamosUnaEmpresa: number;
  reclamosMultiEmpresa: number;
  causasIncompatiblesRubro: number;
  usaValidacionRubros: boolean;
};

export type ReclamoEstadisticas = {
  total: number;
  computedAt: string;
  filtersApplied: ReclamoEstadisticasFilters;
  rangoFechas: { desde: string | null; hasta: string | null };
  resumen: ReclamoEstadisticasResumen;
  porEstado: RankedCount[];
  porGrupo: RankedCount[];
  porBandeja: RankedCount[];
  porResponsable: RankedCount[];
  sinResponsable: number;
  responsablesDisponibles: ResponsableOption[];
  porProvincia: RankedCount[];
  porCiudad: RankedCount[];
  porMes: RankedCount[];
  porAnio: RankedCount[];
  porEmpresa: RankedCount[];
  porCausa: RankedCount[];
  combosEmpresaCausa: EmpresaCausaCombo[];
  tiempoPromedioAsignacionDias: number | null;
  tiempoPromedioDesdeCreacionDias: number | null;
};

export type ReclamoEstadisticasFiltrosCatalogos = {
  causas: Array<{ id: number; descripcion: string }>;
  estados: Array<{ id: number; descripcion: string; idGrupoEstado: number }>;
  provincias: Array<{ id: number; nombre: string }>;
};
