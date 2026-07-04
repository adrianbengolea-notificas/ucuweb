export type ReclamoSearchIndexDoc = {
  id: number;
  empresaIds: number[];
  empresaNombres: string[];
  empresaSearch: string;
  causaIds: number[];
  causaTextos: string[];
  resumen: string;
  hechoPreview: string;
  textoSearch: string;
  estadoDescripcion: string;
  idCasoEstado: number;
  idGrupoEstado?: number;
  provinciaNombre?: string;
  ciudadNombre?: string;
  createdAt: string;
  updatedAt: string;
  anonPreview: string;
  indexedAt: string;
};

export type ReclamoSearchFilters = {
  empresaQuery?: string;
  empresaId?: number;
  keywords?: string[];
  dateFrom?: string;
  dateTo?: string;
  idGrupoEstado?: number;
  causaKeywords?: string[];
};

export type ReclamoSearchHit = {
  id: number;
  resumen: string;
  empresaNombres: string[];
  causaTextos: string[];
  estadoDescripcion: string;
  idGrupoEstado?: number;
  provinciaNombre?: string;
  createdAt: string;
  anonPreview: string;
};

export type ReclamoSearchStats = {
  total: number;
  porEstado: Record<string, number>;
  porGrupo: Record<string, number>;
  rangoFechas: { desde: string | null; hasta: string | null };
};

export type ReclamoSearchResult = {
  hits: ReclamoSearchHit[];
  stats: ReclamoSearchStats;
  filtersApplied: ReclamoSearchFilters;
  interpretacion?: string;
};
