import {
  getCiudadesFromFirestore,
  getDivisasFromFirestore,
  getEmpresasFromFirestore,
  getEtiquetasFromFirestore,
  getFalloByIdFromFirestore,
  getFallosFromFirestore,
  getJuzgadosFromFirestore,
  getProvinciasFromFirestore,
  getReclamosFromFirestore,
  getRubrosFromFirestore,
  getTiposJuicioFromFirestore,
  hasObservatorioInFirestore,
} from '@/lib/observatorio-store';
import type {
  CiudadOption,
  DivisaOption,
  EmpresaOption,
  EtiquetaOption,
  FalloDocument,
  FalloSearchParams,
  FallosResponse,
  JuzgadoOption,
  ProvinciaOption,
  ReclamoOption,
  RubroOption,
  TipoJuicioOption,
} from '@/types/observatorio';

const DEFAULT_API_URL = 'https://vps-3844415-x.dattaweb.com/observatorio-api';

export function getObservatorioApiUrl(): string {
  return (process.env.OBSERVATORIO_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function observatorioFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  revalidate = 300
): Promise<T> {
  const base = getObservatorioApiUrl();
  const normalizedPath = path.replace(/^\//, '');
  const url = `${base}/${normalizedPath}${params ? buildQuery(params) : ''}`;

  const response = await fetch(url, {
    next: { revalidate },
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Observatorio API respondió ${response.status} para ${normalizedPath}`);
  }

  return response.json() as Promise<T>;
}

async function getFallosFromApi(params: FalloSearchParams = {}): Promise<FallosResponse> {
  return observatorioFetch<FallosResponse>('api/fallo/', {
    page: params.page ?? 1,
    offset: params.offset ?? 10,
    actor: params.actor,
    rubro: params.rubro,
    tipoJuicio: params.tipoJuicio,
    causas: params.causas,
    etiquetas: params.etiquetas,
    idProvincia: params.idProvincia,
    idCiudad: params.idCiudad,
    idTribunal: params.idTribunal,
    demandado: params.demandado,
  });
}

async function getFalloByIdFromApi(id: number): Promise<FalloDocument | null> {
  try {
    return await observatorioFetch<FalloDocument>(`api/fallo/${id}`);
  } catch {
    return null;
  }
}

export async function getFallos(params: FalloSearchParams = {}): Promise<FallosResponse> {
  if (await hasObservatorioInFirestore()) {
    return getFallosFromFirestore(params);
  }
  return getFallosFromApi(params);
}

export async function getFalloById(id: number): Promise<FalloDocument | null> {
  if (await hasObservatorioInFirestore()) {
    return getFalloByIdFromFirestore(id);
  }
  return getFalloByIdFromApi(id);
}

export async function getRubros(): Promise<RubroOption[]> {
  if (await hasObservatorioInFirestore()) return getRubrosFromFirestore();
  return observatorioFetch<RubroOption[]>('api/datos/rubros');
}

export async function getProvincias(): Promise<ProvinciaOption[]> {
  if (await hasObservatorioInFirestore()) return getProvinciasFromFirestore();
  return observatorioFetch<ProvinciaOption[]>('api/datos/provincias');
}

export async function getCiudades(idProvincia: number): Promise<CiudadOption[]> {
  if (await hasObservatorioInFirestore()) return getCiudadesFromFirestore(idProvincia);
  return observatorioFetch<CiudadOption[]>('api/datos/ciudades', { idProvincia });
}

export async function getJuzgados(idCiudad: number): Promise<JuzgadoOption[]> {
  if (await hasObservatorioInFirestore()) {
    const cached = await getJuzgadosFromFirestore(idCiudad);
    if (cached.length) return cached;
  }

  const remote = await observatorioFetch<JuzgadoOption[]>('api/datos/juzgados', { idCiudad });
  if (await hasObservatorioInFirestore()) {
    const { cacheJuzgados } = await import('@/lib/observatorio-store');
    await cacheJuzgados(remote.map((item) => ({ ...item, idCiudad })));
  }
  return remote;
}

export async function getTiposJuicio(): Promise<TipoJuicioOption[]> {
  if (await hasObservatorioInFirestore()) return getTiposJuicioFromFirestore();
  const items = await observatorioFetch<Array<{ id: number; description: string }>>(
    'api/datos/tipojuicio'
  );
  return items
    .map((item) => ({ id: item.id, nombre: item.description }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getReclamos(): Promise<ReclamoOption[]> {
  if (await hasObservatorioInFirestore()) return getReclamosFromFirestore();
  return observatorioFetch<ReclamoOption[]>('api/datos/reclamos');
}

export async function getEtiquetas(): Promise<EtiquetaOption[]> {
  if (await hasObservatorioInFirestore()) return getEtiquetasFromFirestore();
  return observatorioFetch<EtiquetaOption[]>('api/datos/etiquetas');
}

export async function getEmpresas(): Promise<EmpresaOption[]> {
  if (await hasObservatorioInFirestore()) return getEmpresasFromFirestore();
  return observatorioFetch<EmpresaOption[]>('api/datos/empresas');
}

export async function getDivisas(): Promise<DivisaOption[]> {
  if (await hasObservatorioInFirestore()) return getDivisasFromFirestore();
  const items = await observatorioFetch<
    Array<{ id: number; codigoDivisa: string; nombreDivisa: string; pais?: string }>
  >('api/datos/divisas');
  return items.map((item) => ({
    id: item.id,
    codigo: item.codigoDivisa,
    nombre: item.nombreDivisa,
    pais: item.pais,
  }));
}

export function formatDemandado(fallo: FalloDocument): string {
  if (fallo.demandado) return fallo.demandado;
  if (fallo.demandadoEmpresas.length) {
    return fallo.demandadoEmpresas.map((e) => e.razon_social).join(', ');
  }
  if (fallo.demandadoActores.length) {
    return fallo.demandadoActores.map((e) => e.razon_social).join(', ');
  }
  return 'Sin especificar';
}

export function formatMonto(fallo: FalloDocument): string | null {
  const total =
    Number(fallo.patrimonial || 0) +
    Number(fallo.moral || 0) +
    Number(fallo.punitivo || 0);

  if (!total) return null;

  const code = fallo.divisa?.codigo ?? 'ARS';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: code === 'ARS' ? 'ARS' : code,
    maximumFractionDigits: 0,
  }).format(total);
}

export function parseSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): FalloSearchParams {
  const read = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const readNumber = (key: string) => {
    const value = read(key);
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    page: readNumber('page') ?? 1,
    offset: readNumber('offset') ?? 10,
    actor: read('actor')?.trim() || undefined,
    rubro: readNumber('rubro'),
    tipoJuicio: readNumber('tipoJuicio'),
    causas: readNumber('causas'),
    etiquetas: readNumber('etiquetas'),
    idProvincia: readNumber('idProvincia'),
    idCiudad: readNumber('idCiudad'),
    idTribunal: readNumber('idTribunal'),
    demandado: readNumber('demandado'),
  };
}

export function buildSearchQuery(params: FalloSearchParams): string {
  const query = new URLSearchParams();
  const entries: [keyof FalloSearchParams, string | number | undefined][] = [
    ['page', params.page && params.page > 1 ? params.page : undefined],
    ['offset', params.offset && params.offset !== 10 ? params.offset : undefined],
    ['actor', params.actor],
    ['rubro', params.rubro],
    ['tipoJuicio', params.tipoJuicio],
    ['causas', params.causas],
    ['etiquetas', params.etiquetas],
    ['idProvincia', params.idProvincia],
    ['idCiudad', params.idCiudad],
    ['idTribunal', params.idTribunal],
    ['demandado', params.demandado],
  ];

  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}
