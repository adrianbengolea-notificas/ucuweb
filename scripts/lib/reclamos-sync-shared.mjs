import sql from 'mssql';
import { qualified, schemaName } from './reclamos-sql-config.mjs';

export function trim(value) {
  return String(value ?? '').trim();
}

export function toIso(value) {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function titleCase(value) {
  return trim(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function computeAdminBandeja(doc) {
  if (doc.idGrupoEstado === 3) return 'archivados';
  if (doc.idCasoEstado === 1 && !doc.responsable) return 'recibidos';
  return 'gestion';
}

export async function loadColumns(pool, table) {
  const result = await pool
    .request()
    .input('table', sql.NVarChar, table)
    .input('schema', sql.NVarChar, schemaName())
    .query(`
    SELECT COLUMN_NAME, DATA_TYPE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
    ORDER BY ORDINAL_POSITION
  `);
  return result.recordset;
}

export function pickColumn(columns, candidates) {
  const names = columns.map((col) => col.COLUMN_NAME.toLowerCase());
  for (const candidate of candidates) {
    const index = names.indexOf(candidate.toLowerCase());
    if (index >= 0) return columns[index].COLUMN_NAME;
  }
  return null;
}

export async function loadEstadosMap(pool) {
  const result = await pool.request().query(`
    SELECT id_caso_estado, descripcion, id_caso_grupo_estado, activo
    FROM ${qualified('casos_estados')}
    ORDER BY id_caso_estado
  `);

  const rows = result.recordset.map((row) => ({
    id: row.id_caso_estado,
    descripcion: titleCase(row.descripcion),
    idGrupoEstado: row.id_caso_grupo_estado,
    activo: row.activo == null ? true : Boolean(row.activo),
  }));

  return {
    rows,
    byId: new Map(rows.map((row) => [row.id, row])),
  };
}

export async function loadGruposEstados(pool) {
  const result = await pool.request().query(`
    SELECT id_caso_grupo_estado, descripcion, estado, activo
    FROM ${qualified('casos_grupos_estados')}
    ORDER BY id_caso_grupo_estado
  `);

  return result.recordset.map((row) => ({
    id: row.id_caso_grupo_estado,
    descripcion: trim(row.descripcion),
    estado: trim(row.estado),
    activo: row.activo == null ? true : Boolean(row.activo),
  }));
}

export async function loadCausasCatalog(pool) {
  const result = await pool.request().query(`
    SELECT id_causa, descripcion, activo
    FROM ${qualified('causas')}
    ORDER BY id_causa
  `);

  return result.recordset.map((row) => ({
    id: row.id_causa,
    descripcion: trim(row.descripcion),
    activo: Boolean(row.activo),
  }));
}

export async function loadTiposReclamos(pool) {
  const result = await pool.request().query(`
    SELECT id_tipo_reclamo, descripcion, activo
    FROM ${qualified('tipos_reclamos')}
    ORDER BY id_tipo_reclamo
  `);

  return result.recordset.map((row) => ({
    id: row.id_tipo_reclamo,
    descripcion: titleCase(row.descripcion),
    activo: Boolean(row.activo),
  }));
}

export async function loadPersonasMap(pool) {
  const result = await pool.request().query(`
    SELECT id_persona, nombre, apellido, correo_electronico
    FROM ${qualified('personas')}
  `);

  const map = new Map();
  for (const row of result.recordset) {
    map.set(row.id_persona, {
      name: `${trim(row.nombre)} ${trim(row.apellido)}`.trim() || `Operador #${row.id_persona}`,
      email: trim(row.correo_electronico).toLowerCase() || undefined,
    });
  }
  return map;
}

export function resolvePersona(personas, idPersona) {
  if (idPersona == null) return { name: 'Sistema', email: undefined };
  const persona = personas.get(idPersona);
  if (persona) return persona;
  if (Number(idPersona) === 0) return { name: 'Sistema', email: 'sistema@hotmail.com' };
  return { name: `Operador #${idPersona}`, email: undefined };
}

export async function buildGuidToNumericMap(pool) {
  const reclamoColumns = await loadColumns(pool, 'reclamos');
  const denuncianteColumns = await loadColumns(pool, 'denunciantes');
  const reclamoId = pickColumn(reclamoColumns, ['id_reclamo', 'id']);
  const denuncianteFk = pickColumn(reclamoColumns, ['id_denunciante', 'denunciante_id']);
  const dId = pickColumn(denuncianteColumns, ['id_denunciante', 'id']);
  const fechaAlta = pickColumn(reclamoColumns, ['fecha_alta', 'fecha', 'created_at']);

  if (!reclamoId || !denuncianteFk || !dId) {
    throw new Error('No se detectaron columnas clave para mapear GUID → ID numérico.');
  }

  const result = await pool.request().query(`
    SELECT id_numerico, id_reclamo
    FROM (
      SELECT ROW_NUMBER() OVER (ORDER BY r.[${fechaAlta || reclamoId}] ASC, r.[${reclamoId}] ASC) AS id_numerico,
             r.[${reclamoId}] AS id_reclamo
      FROM ${qualified('reclamos')} r
      INNER JOIN ${qualified('denunciantes')} d ON d.[${dId}] = r.[${denuncianteFk}]
    ) mapped
  `);

  const guidToId = new Map();
  const idToGuid = new Map();
  for (const row of result.recordset) {
    const guid = String(row.id_reclamo).toUpperCase();
    guidToId.set(guid, Number(row.id_numerico));
    idToGuid.set(Number(row.id_numerico), guid);
  }
  return { guidToId, idToGuid };
}

export async function loadHistoricoByGuid(pool, estados, personas) {
  const result = await pool.request().query(`
    SELECT h.id_reclamo, h.id_estado, h.fecha, h.id_persona
    FROM ${qualified('historico_reclamos_estados')} h
    ORDER BY h.fecha ASC, h.id_reclamo_estado ASC
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const guid = String(row.id_reclamo).toUpperCase();
    const estado = estados.byId.get(row.id_estado);
    const author = resolvePersona(personas, row.id_persona);
    const list = map.get(guid) ?? [];
    list.push({
      idCasoEstado: row.id_estado,
      estadoDescripcion: estado?.descripcion ?? `Estado ${row.id_estado}`,
      idGrupoEstado: estado?.idGrupoEstado,
      changedAt: toIso(row.fecha),
      changedByEmail: author.email,
      changedByName: author.name,
    });
    map.set(guid, list);
  }
  return map;
}

export async function loadComentariosByGuid(pool, personas) {
  const result = await pool.request().query(`
    SELECT c.id_reclamo_comentario, c.id_reclamo, c.comentario, c.es_interno, c.id_persona, c.fecha
    FROM ${qualified('reclamos_comentarios')} c
    ORDER BY c.fecha DESC, c.id_reclamo_comentario DESC
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const guid = String(row.id_reclamo).toUpperCase();
    const author = resolvePersona(personas, row.id_persona);
    const list = map.get(guid) ?? [];
    list.push({
      id: String(row.id_reclamo_comentario),
      texto: trim(row.comentario),
      esInterno: Boolean(row.es_interno),
      createdAt: toIso(row.fecha),
      authorEmail: author.email ?? '',
      authorName: author.name,
    });
    map.set(guid, list);
  }
  return map;
}

export async function loadResponsablesByGuid(pool, personas) {
  const result = await pool.request().query(`
    SELECT r.id_reclamo, r.id_persona, r.fecha_delegado
    FROM ${qualified('reclamos_responsables')} r
    WHERE r.activo = 1
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const guid = String(row.id_reclamo).toUpperCase();
    const persona = resolvePersona(personas, row.id_persona);
    map.set(guid, {
      email: persona.email ?? '',
      name: persona.name,
      assignedAt: toIso(row.fecha_delegado),
    });
  }
  return map;
}

export async function loadCausasByGuid(pool) {
  const result = await pool.request().query(`
    SELECT rc.id_reclamo, rc.id_causa, c.descripcion
    FROM ${qualified('reclamos_causas')} rc
    INNER JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa
    WHERE rc.activo = 1 AND c.activo = 1
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const guid = String(row.id_reclamo).toUpperCase();
    const list = map.get(guid) ?? [];
    list.push({
      id: row.id_causa,
      descripcion: trim(row.descripcion),
    });
    map.set(guid, list);
  }
  return map;
}

export async function loadCausasRubros(pool) {
  const result = await pool.request().query(`
    SELECT cr.id_causa, cr.id_rubro
    FROM ${qualified('causas_rubros')} cr
    INNER JOIN ${qualified('causas')} c ON c.id_causa = cr.id_causa AND c.activo = 1
    INNER JOIN ${qualified('rubros')} r ON r.id_rubro = cr.id_rubro AND r.activo = 1
  `);

  return result.recordset.map((row) => ({
    causaId: row.id_causa,
    rubroId: row.id_rubro,
  }));
}

export async function loadEmpresasRubros(pool) {
  const result = await pool.request().query(`
    SELECT er.id_empresa, er.id_rubro, r.descripcion AS rubro_nombre
    FROM ${qualified('empresas_rubros')} er
    INNER JOIN ${qualified('rubros')} r ON r.id_rubro = er.id_rubro AND r.activo = 1
  `);

  return result.recordset.map((row) => ({
    empresaId: row.id_empresa,
    rubroId: row.id_rubro,
    rubroNombre: trim(row.rubro_nombre),
  }));
}

export function sanitizeCausasForReclamo(reclamo, maps) {
  const causas = reclamo.causas ?? [];
  if (!causas.length) return { causas: [], removidas: [] };

  const empresaIds = reclamo.empresaIds?.length
    ? reclamo.empresaIds
    : (reclamo.empresas ?? []).map((e) => e.id);

  const rubroSet = new Set();
  for (const empresaId of empresaIds) {
    for (const rubroId of maps.rubroIdsByEmpresa.get(empresaId) ?? []) {
      rubroSet.add(rubroId);
    }
  }
  const rubroIds = [...rubroSet];
  const sinRubroEmpresa = empresaIds.length > 0 && rubroSet.size === 0;

  const validas = [];
  const removidas = [];

  for (const causa of causas) {
    if (!maps.activeCausaIds.has(causa.id)) {
      removidas.push(causa);
      continue;
    }
    const compatible =
      sinRubroEmpresa ||
      rubroIds.some((rubroId) => maps.causaIdsByRubro.get(rubroId)?.has(causa.id));
    if (compatible) validas.push(causa);
    else removidas.push(causa);
  }

  return { causas: validas, removidas };
}

export function buildCausaValidationMaps(causaRubroPairs, empresaRubroEntries, causasCatalog) {
  const causaIdsByRubro = new Map();
  for (const { causaId, rubroId } of causaRubroPairs) {
    const set = causaIdsByRubro.get(rubroId) ?? new Set();
    set.add(causaId);
    causaIdsByRubro.set(rubroId, set);
  }

  const rubroIdsByEmpresa = new Map();
  for (const { empresaId, rubroId } of empresaRubroEntries) {
    const list = rubroIdsByEmpresa.get(empresaId) ?? [];
    if (!list.includes(rubroId)) list.push(rubroId);
    rubroIdsByEmpresa.set(empresaId, list);
  }

  const activeCausaIds = new Set(
    causasCatalog.filter((c) => c.activo !== false).map((c) => c.id)
  );

  return { causaIdsByRubro, rubroIdsByEmpresa, activeCausaIds };
}

export function normalizeDriveUrl(value) {
  const url = trim(value);
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export async function loadEnlacesByGuid(pool) {
  const result = await pool.request().query(`
    SELECT id_reclamo, google_drive, google_drive_sentencia, numero_expendiente, id_juzgado
    FROM ${qualified('reclamos')}
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const guid = String(row.id_reclamo).toUpperCase();
    const numeroExpediente = trim(row.numero_expendiente);

    map.set(guid, {
      googleDrive: normalizeDriveUrl(row.google_drive),
      googleDriveSentencia: normalizeDriveUrl(row.google_drive_sentencia),
      numeroExpediente: numeroExpediente || undefined,
      idJuzgado: row.id_juzgado ?? undefined,
    });
  }
  return map;
}

export async function writeCatalogBatch(db, collection, items, dryRun) {
  if (!items.length) return;
  const batchSize = 400;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = db.batch();
    for (const item of items.slice(index, index + batchSize)) {
      batch.set(db.collection(collection).doc(String(item.id)), item, { merge: true });
    }
    if (!dryRun) await batch.commit();
    console.log(`${collection}: ${Math.min(index + batchSize, items.length)}/${items.length}`);
  }
}

export function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}
