import { fixEncodingDeep } from '@/lib/fix-encoding';
import { resolveFalloFileUrl } from '@/lib/fallos-files';
import type { FalloDocument, FalloFormPayload, StoredFalloDocument } from '@/types/observatorio';

export function parseFechaSort(fecha: string): string {
  const parts = fecha.trim().split('/');
  if (parts.length !== 3) return new Date(0).toISOString();
  const [day, month, year] = parts.map((part) => Number(part));
  if (!day || !month || !year) return new Date(0).toISOString();
  return new Date(year, month - 1, day).toISOString();
}

export function formatTodayFecha(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
}

export function normalizeFalloDocument(
  input: FalloDocument,
  status: 'publish' | 'draft' = 'publish'
): StoredFalloDocument {
  return {
    ...input,
    files: (input.files ?? []).map((file) => ({
      ...file,
      url: resolveFalloFileUrl(file.url ?? '', input.nroExpediente, file.file),
    })),
    status,
    actorSearch: (input.actor ?? '').trim().toLowerCase(),
    rubroIds: (input.rubro ?? []).map((item) => item.id),
    causaIds: (input.causas ?? []).map((item) => item.id),
    etiquetaIds: (input.etiquetas ?? []).map((item) => item.id),
    demandadoEmpresaIds: (input.demandadoEmpresas ?? []).map((item) => item.id),
    tipoJuicioId: input.tipoJuicio?.id ?? null,
    provinciaId: input.provincia?.id ?? null,
    ciudadId: input.ciudad?.id ?? null,
    juzgadoId: input.juzgado?.id ?? null,
    fechaSort: parseFechaSort(input.fecha),
  };
}

/** Completa campos normalizados si faltan (docs migrados parcialmente). */
export function repairStoredFalloDocument(fallo: StoredFalloDocument): StoredFalloDocument {
  return fixEncodingDeep(
    normalizeFalloDocument(
      {
        ...fallo,
        rubro: fallo.rubro ?? [],
        causas: fallo.causas ?? [],
        etiquetas: fallo.etiquetas ?? [],
        demandadoEmpresas: fallo.demandadoEmpresas ?? [],
        demandadoActores: fallo.demandadoActores ?? [],
        files: fallo.files ?? [],
      },
      fallo.status ?? 'publish'
    )
  );
}

export function buildFalloDocumentFromForm(
  payload: FalloFormPayload,
  catalogs: {
    empresas: Map<number, { id: number; razon_social: string; cuit?: string }>;
    rubros: Map<number, { id: number; nombre: string }>;
    reclamos: Map<number, { id: number; nombre: string }>;
    etiquetas: Map<number, { id: number; nombre: string }>;
    tiposJuicio: Map<number, { id: number; nombre: string }>;
    provincias: Map<number, { id: number; nombre: string }>;
    ciudades: Map<number, { id: number; nombre: string }>;
    juzgados: Map<number, { id: number; nombre: string }>;
    divisas: Map<number, { id: number; codigo: string; nombre: string }>;
  },
  existing?: StoredFalloDocument
): StoredFalloDocument {
  const now = formatTodayFecha();

  const mapEmpresa = (id: number) => {
    const item = catalogs.empresas.get(id);
    if (!item) return null;
    return { id: item.id, razon_social: item.razon_social, cuit: item.cuit };
  };

  const actorEmpresas = payload.actorEmpresaIds
    .map(mapEmpresa)
    .filter(Boolean) as FalloDocument['demandadoActores'];

  const demandadoEmpresas = payload.personDemandado
    ? []
    : (payload.demandadoEmpresaIds.map(mapEmpresa).filter(Boolean) as FalloDocument['demandadoEmpresas']);

  const defaultDivisa = existing?.divisa ?? {
    id: 7,
    nombre: 'Peso argentino',
    codigo: 'ARS',
  };
  const selectedDivisa = payload.divisaId
    ? catalogs.divisas.get(payload.divisaId)
    : null;

  const base: FalloDocument = {
    nroExpediente: existing?.nroExpediente ?? 0,
    actor: payload.firmActor ? null : payload.actor.trim() || null,
    demandado: payload.personDemandado ? payload.demandado.trim() || null : null,
    demandadoActores: payload.firmActor ? actorEmpresas : [],
    demandadoEmpresas,
    tipoJuicio: payload.tipoJuicioId
      ? catalogs.tiposJuicio.get(payload.tipoJuicioId) ?? null
      : null,
    provincia: payload.provinciaId
      ? {
          id: payload.provinciaId,
          nombre:
            catalogs.provincias.get(payload.provinciaId)?.nombre ??
            (existing?.provincia?.id === payload.provinciaId ? existing.provincia.nombre : null),
        }
      : null,
    ciudad: payload.ciudadId
      ? {
          id: payload.ciudadId,
          nombre:
            catalogs.ciudades.get(payload.ciudadId)?.nombre ??
            (existing?.ciudad?.id === payload.ciudadId ? existing.ciudad.nombre : null),
        }
      : null,
    juzgado: payload.juzgadoId
      ? {
          id: payload.juzgadoId,
          nombre:
            catalogs.juzgados.get(payload.juzgadoId)?.nombre ??
            (existing?.juzgado?.id === payload.juzgadoId ? existing.juzgado.nombre : '') ??
            '',
        }
      : null,
    fecha: payload.fecha.trim() || now,
    punitivo: payload.punitivo || '0.00',
    moral: payload.moral || '0.00',
    patrimonial: payload.patrimonial || '0.00',
    divisa: selectedDivisa
      ? {
          id: selectedDivisa.id,
          nombre: selectedDivisa.nombre,
          codigo: selectedDivisa.codigo,
        }
      : defaultDivisa,
    resumen: payload.resumen.trim(),
    rubro: payload.rubroIds
      .map((id) => catalogs.rubros.get(id))
      .filter(Boolean)
      .map((item) => item!),
    causas: payload.causaIds
      .map((id) => catalogs.reclamos.get(id))
      .filter(Boolean)
      .map((item) => item!),
    etiquetas: payload.etiquetaIds
      .map((id) => catalogs.etiquetas.get(id))
      .filter(Boolean)
      .map((item) => item!),
    files: existing?.files ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };

  return normalizeFalloDocument(base, payload.status);
}
