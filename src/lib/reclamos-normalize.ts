import type {
  ReclamoCiudad,
  ReclamoDenunciante,
  ReclamoEmpresa,
  ReclamoEmpresaRef,
  ReclamoEstado,
  ReclamoFormPayload,
  ReclamoProvincia,
  StoredReclamoDocument,
} from '@/types/reclamos';
import { buildHistorialEntry, computeAdminBandeja } from '@/lib/reclamos-admin';

export type ReclamoCatalogLookups = {
  provincias: Map<number, ReclamoProvincia>;
  ciudades: Map<number, ReclamoCiudad>;
  empresas: Map<number, ReclamoEmpresa>;
  estados: Map<number, ReclamoEstado>;
};

export function buildDenuncianteFromForm(
  payload: ReclamoFormPayload,
  catalogs: ReclamoCatalogLookups
): ReclamoDenunciante {
  const provincia = catalogs.provincias.get(payload.provinciaId);
  const ciudad = catalogs.ciudades.get(payload.ciudadId);

  return {
    nombre: payload.nombre.trim(),
    apellido: payload.apellido.trim(),
    tipoDocumento: payload.tipoDocumento.trim(),
    numeroDocumento: payload.numeroDocumento.trim(),
    calle: payload.calle?.trim() || undefined,
    numero: payload.numero?.trim() || undefined,
    piso: payload.piso?.trim() || undefined,
    depto: payload.depto?.trim() || undefined,
    provinciaId: payload.provinciaId,
    ciudadId: payload.ciudadId,
    provinciaNombre: provincia?.nombre,
    ciudadNombre: ciudad?.nombre,
    telefono: payload.telefono.trim(),
    email: payload.email.trim().toLowerCase(),
  };
}

export function resolveEmpresaRefs(
  empresaIds: number[],
  catalogs: ReclamoCatalogLookups
): ReclamoEmpresaRef[] {
  return empresaIds.flatMap((id) => {
    const empresa = catalogs.empresas.get(id);
    if (!empresa) return [];
    return [{ id: empresa.id, nombre: empresa.nombre, cuit: empresa.cuit ?? null }];
  });
}

export function buildReclamoDocumentFromForm(
  id: number,
  payload: ReclamoFormPayload,
  catalogs: ReclamoCatalogLookups,
  idCasoEstado = 1
): StoredReclamoDocument {
  const now = new Date().toISOString();
  const denunciante = buildDenuncianteFromForm(payload, catalogs);
  const empresas = resolveEmpresaRefs(payload.empresaIds, catalogs);
  const estado = catalogs.estados.get(idCasoEstado);
  const nombreSearch =
    `${denunciante.nombre} ${denunciante.apellido}`.trim().toLowerCase();
  const estadoDescripcion = estado?.descripcion.trim();
  const idGrupoEstado = estado?.idGrupoEstado;

  const doc: StoredReclamoDocument = {
    id,
    denunciante,
    resumen: payload.resumen.trim(),
    hecho: payload.hecho.trim(),
    otrasEmpresas: payload.otrasEmpresas?.trim() || undefined,
    empresaIds: payload.empresaIds,
    empresas,
    idCasoEstado,
    estadoDescripcion,
    idGrupoEstado,
    historialEstados: [
      buildHistorialEntry(
        idCasoEstado,
        estadoDescripcion ?? 'Consulta',
        idGrupoEstado,
        undefined,
        'Reclamo recibido desde el formulario público'
      ),
    ],
    idTipo: 1,
    esExterno: true,
    documentoSearch: denunciante.numeroDocumento.replace(/\D/g, ''),
    nombreSearch,
    createdAt: now,
    updatedAt: now,
  };

  doc.adminBandeja = computeAdminBandeja(doc);
  return doc;
}

export function toReclamoPublicView(doc: StoredReclamoDocument) {
  return {
    id: doc.id,
    resumen: doc.resumen,
    estadoDescripcion: doc.estadoDescripcion ?? 'Consulta',
    idGrupoEstado: doc.idGrupoEstado ?? 1,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    empresas: doc.empresas,
  };
}
