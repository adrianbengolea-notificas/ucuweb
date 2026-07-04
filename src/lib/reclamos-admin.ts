import type {
  ReclamoAdminBandeja,
  ReclamoHistorialEstado,
  ReclamoResponsable,
  StoredReclamoDocument,
} from '@/types/reclamos';

export const RECLAMO_ESTADO_CONSULTA = 1;
export const RECLAMO_ESTADO_CARTA_DOCUMENTO = 2;
export const RECLAMO_GRUPO_ARCHIVADO = 3;

export function computeAdminBandeja(
  doc: Pick<StoredReclamoDocument, 'idCasoEstado' | 'idGrupoEstado' | 'responsable'>
): ReclamoAdminBandeja {
  if (doc.idGrupoEstado === RECLAMO_GRUPO_ARCHIVADO) return 'archivados';
  if (doc.idCasoEstado === RECLAMO_ESTADO_CONSULTA && !doc.responsable) return 'recibidos';
  return 'gestion';
}

export function buildHistorialEntry(
  idCasoEstado: number,
  estadoDescripcion: string,
  idGrupoEstado: number | undefined,
  changedBy?: { email: string; name: string },
  nota?: string
): ReclamoHistorialEstado {
  return {
    idCasoEstado,
    estadoDescripcion,
    idGrupoEstado,
    changedAt: new Date().toISOString(),
    changedByEmail: changedBy?.email,
    changedByName: changedBy?.name,
    nota,
  };
}

export function buildResponsable(
  email: string,
  name: string
): ReclamoResponsable {
  return {
    email,
    name,
    assignedAt: new Date().toISOString(),
  };
}

export function resolveAdminBandeja(doc: StoredReclamoDocument): ReclamoAdminBandeja {
  return doc.adminBandeja ?? computeAdminBandeja(doc);
}
