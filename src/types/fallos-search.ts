export type FalloSearchIndexDoc = {
  id: number;
  actor: string;
  demandado: string | null;
  demandadoNombres: string[];
  demandadoEmpresaIds: number[];
  demandadoSearch: string;
  actorSearch: string;
  rubroIds: number[];
  rubroNombres: string[];
  causaIds: number[];
  causaNombres: string[];
  etiquetaIds: number[];
  etiquetaNombres: string[];
  resumen: string;
  textoSearch: string;
  tipoJuicioId: number | null;
  tipoJuicioNombre: string | null;
  provinciaId: number | null;
  provinciaNombre: string | null;
  ciudadId: number | null;
  ciudadNombre: string | null;
  juzgadoId: number | null;
  juzgadoNombre: string | null;
  fecha: string;
  fechaSort: string;
  patrimonial: string;
  moral: string;
  punitivo: string;
  divisaCodigo: string | null;
  status: 'publish' | 'draft';
  createdAt: string;
  updatedAt: string;
  anonPreview: string;
  indexedAt: string;
};

export type FalloSearchFilters = {
  empresaQuery?: string;
  empresaId?: number;
  actorQuery?: string;
  keywords?: string[];
  dateFrom?: string;
  dateTo?: string;
  rubroId?: number;
  causaId?: number;
  etiquetaId?: number;
  tipoJuicioId?: number;
  provinciaId?: number;
  ciudadId?: number;
  status?: 'publish' | 'draft' | 'all';
  rubroKeywords?: string[];
  causaKeywords?: string[];
  etiquetaKeywords?: string[];
};

export type FalloSearchHit = {
  id: number;
  actor: string;
  demandado: string | null;
  demandadoNombres: string[];
  resumen: string;
  rubroNombres: string[];
  causaNombres: string[];
  tipoJuicioNombre: string | null;
  provinciaNombre: string | null;
  juzgadoNombre: string | null;
  fecha: string;
  patrimonial: string;
  moral: string;
  punitivo: string;
  divisaCodigo: string | null;
  status: 'publish' | 'draft';
  anonPreview: string;
};

export type FalloSearchStats = {
  total: number;
  porRubro: Record<string, number>;
  porProvincia: Record<string, number>;
  porTipoJuicio: Record<string, number>;
  rangoFechas: { desde: string | null; hasta: string | null };
};

export type FalloSearchResult = {
  hits: FalloSearchHit[];
  stats: FalloSearchStats;
  filtersApplied: FalloSearchFilters;
  interpretacion?: string;
};
