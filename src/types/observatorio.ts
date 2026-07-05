export type FalloEmpresa = {
  id: number;
  razon_social: string;
  cuit?: string;
};

export type FalloNamed = {
  id: number;
  nombre: string;
};

export type FalloFile = {
  id: number;
  file: string;
  url: string;
};

export type FalloDocument = {
  nroExpediente: number;
  actor: string | null;
  demandado: string | null;
  demandadoActores: FalloEmpresa[];
  demandadoEmpresas: FalloEmpresa[];
  tipoJuicio: FalloNamed | null;
  ciudad: { id: number | null; nombre: string | null } | null;
  provincia: { id: number | null; nombre: string | null } | null;
  juzgado: FalloNamed | null;
  fecha: string;
  punitivo: string;
  moral: string;
  patrimonial: string;
  divisa: { id: number; nombre: string; codigo: string } | null;
  resumen: string;
  rubro: FalloNamed[];
  causas: FalloNamed[];
  etiquetas: FalloNamed[];
  files: FalloFile[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type StoredFalloDocument = FalloDocument & {
  status: 'publish' | 'draft';
  actorSearch: string;
  rubroIds: number[];
  causaIds: number[];
  etiquetaIds: number[];
  demandadoEmpresaIds: number[];
  tipoJuicioId: number | null;
  provinciaId: number | null;
  ciudadId: number | null;
  juzgadoId: number | null;
  fechaSort: string;
};

export type FallosResponse = {
  totalRows: number;
  totalPages: number;
  currentPage: number;
  data: FalloDocument[];
};

export type FalloSearchParams = {
  page?: number;
  offset?: number;
  actor?: string;
  rubro?: number[];
  tipoJuicio?: number;
  causas?: number[];
  etiquetas?: number[];
  idProvincia?: number;
  idCiudad?: number;
  idTribunal?: number;
  demandado?: number[];
};

export type RubroOption = { id: number; rubro: string };
export type ProvinciaOption = { id: number; nombre: string };
export type CiudadOption = { id: number; nombre: string; idProvincia?: number };
export type JuzgadoOption = { id: number; nombre: string; idCiudad?: number };
export type TipoJuicioOption = { id: number; nombre: string };
export type ReclamoOption = { id: number; description: string };
export type EtiquetaOption = { id: number; description: string };
export type EmpresaOption = {
  id: number;
  razon_social: string;
  cuit?: string;
  direccion?: string;
  servicio?: string;
};

export type DivisaOption = {
  id: number;
  codigo: string;
  nombre: string;
  pais?: string;
};

export type FalloFormPayload = {
  actor: string;
  demandado: string;
  firmActor: boolean;
  personDemandado: boolean;
  actorEmpresaIds: number[];
  demandadoEmpresaIds: number[];
  divisaId: number | null;
  resumen: string;
  fecha: string;
  tipoJuicioId: number | null;
  rubroIds: number[];
  causaIds: number[];
  etiquetaIds: number[];
  provinciaId: number | null;
  ciudadId: number | null;
  juzgadoId: number | null;
  punitivo: string;
  moral: string;
  patrimonial: string;
  status: 'publish' | 'draft';
};

export type ObservatorioCatalogType =
  | 'rubros'
  | 'provincias'
  | 'ciudades'
  | 'juzgados'
  | 'tipojuicio'
  | 'reclamos'
  | 'etiquetas'
  | 'empresas'
  | 'divisas';
