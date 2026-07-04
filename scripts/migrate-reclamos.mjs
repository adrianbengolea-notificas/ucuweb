#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import admin from 'firebase-admin';
import { getReclamosSqlConfig, qualified, schemaName } from './lib/reclamos-sql-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
const batchSize = Number(process.env.RECLAMOS_MIGRATE_BATCH || 200);

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales Firebase Admin en .env.local');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function trim(value) {
  return String(value ?? '').trim();
}

function toIso(value) {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function pickColumn(columns, candidates) {
  const names = columns.map((col) => col.COLUMN_NAME.toLowerCase());
  for (const candidate of candidates) {
    const index = names.indexOf(candidate.toLowerCase());
    if (index >= 0) return columns[index].COLUMN_NAME;
  }
  return null;
}

async function loadColumns(pool, table) {
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

async function loadEstados(pool) {
  const result = await pool.request().query(`
    SELECT id_caso_estado, descripcion, id_caso_grupo_estado
    FROM ${qualified('casos_estados')}
  `);
  return new Map(
    result.recordset.map((row) => [
      row.id_caso_estado,
      {
        descripcion: trim(row.descripcion),
        idGrupoEstado: row.id_caso_grupo_estado,
      },
    ])
  );
}

async function loadCiudadesProvincias(pool) {
  const ciudades = await pool.request().query(`
    SELECT c.id_ciudad, c.nombre AS ciudad, p.id_provincia, p.nombre AS provincia
    FROM ${qualified('ciudades')} c
    INNER JOIN ${qualified('provincias')} p ON p.id_provincia = c.id_provincia
  `);
  return new Map(
    ciudades.recordset.map((row) => [
      row.id_ciudad,
      {
        ciudadId: row.id_ciudad,
        ciudadNombre: trim(row.ciudad),
        provinciaId: row.id_provincia,
        provinciaNombre: trim(row.provincia),
      },
    ])
  );
}

async function loadEmpresasPorReclamo(pool) {
  const result = await pool.request().query(`
    SELECT re.id_reclamo, e.id_empresa, e.nombre, e.cuit
    FROM ${qualified('reclamos_empresas')} re
    INNER JOIN ${qualified('empresas')} e ON e.id_empresa = re.id_empresa
  `);

  const map = new Map();
  for (const row of result.recordset) {
    const key = String(row.id_reclamo);
    const list = map.get(key) ?? [];
    list.push({
      id: row.id_empresa,
      nombre: trim(row.nombre),
      cuit: row.cuit ? trim(row.cuit) : null,
    });
    map.set(key, list);
  }
  return map;
}

function buildSelectQuery(reclamoColumns, denuncianteColumns) {
  const reclamoId = pickColumn(reclamoColumns, ['id_reclamo', 'id']);
  const denuncianteFk = pickColumn(reclamoColumns, ['id_denunciante', 'denunciante_id']);
  const resumen = pickColumn(reclamoColumns, ['resumen']);
  const hecho = pickColumn(reclamoColumns, ['hecho', 'descripcion']);
  const otrasEmpresas = pickColumn(reclamoColumns, ['otras_empresas']);
  const idCasoEstado = pickColumn(reclamoColumns, ['id_caso_estado']);
  const idTipo = pickColumn(reclamoColumns, ['id_tipo', 'id_tipo_reclamo']);
  const esExterno = pickColumn(reclamoColumns, ['es_externo']);
  const fechaAlta = pickColumn(reclamoColumns, ['fecha_alta', 'fecha', 'created_at']);
  const fechaMod = pickColumn(reclamoColumns, ['fecha_modificacion', 'fecha_mod', 'updated_at']);
  const googleDrive = pickColumn(reclamoColumns, ['google_drive']);
  const googleDriveSentencia = pickColumn(reclamoColumns, ['google_drive_sentencia']);
  const numeroExpediente = pickColumn(reclamoColumns, ['numero_expendiente', 'numero_expediente']);
  const idJuzgado = pickColumn(reclamoColumns, ['id_juzgado']);

  if (!reclamoId || !denuncianteFk) {
    throw new Error(
      `No se detectaron columnas clave en reclamos. Ejecutá npm run probe:reclamos:sql`
    );
  }

  const dId = pickColumn(denuncianteColumns, ['id_denunciante', 'id']);
  const nombre = pickColumn(denuncianteColumns, ['nombre']);
  const apellido = pickColumn(denuncianteColumns, ['apellido']);
  const tipoDocumento = pickColumn(denuncianteColumns, ['tipo_documento']);
  const numeroDocumento = pickColumn(denuncianteColumns, ['numero_documento', 'documento']);
  const calle = pickColumn(denuncianteColumns, ['calle', 'domicilio']);
  const numero = pickColumn(denuncianteColumns, ['numero']);
  const piso = pickColumn(denuncianteColumns, ['piso']);
  const depto = pickColumn(denuncianteColumns, ['depto', 'departamento']);
  const idCiudad = pickColumn(denuncianteColumns, ['id_ciudad']);
  const telefono = pickColumn(denuncianteColumns, ['telefono_1', 'telefono', 'telefono1']);
  const email = pickColumn(denuncianteColumns, ['correo_electronico', 'email']);

  const selectParts = [
    `r.[${reclamoId}] AS id_reclamo`,
    resumen ? `r.[${resumen}] AS resumen` : `CAST('' AS NVARCHAR(200)) AS resumen`,
    hecho ? `r.[${hecho}] AS hecho` : `CAST('' AS NVARCHAR(MAX)) AS hecho`,
    otrasEmpresas ? `r.[${otrasEmpresas}] AS otras_empresas` : `CAST(NULL AS NVARCHAR(MAX)) AS otras_empresas`,
    idCasoEstado ? `r.[${idCasoEstado}] AS id_caso_estado` : `CAST(1 AS INT) AS id_caso_estado`,
    idTipo ? `r.[${idTipo}] AS id_tipo` : `CAST(1 AS INT) AS id_tipo`,
    esExterno ? `r.[${esExterno}] AS es_externo` : `CAST(1 AS BIT) AS es_externo`,
    fechaAlta ? `r.[${fechaAlta}] AS fecha_alta` : `CAST(NULL AS DATETIME) AS fecha_alta`,
    fechaMod ? `r.[${fechaMod}] AS fecha_modificacion` : `CAST(NULL AS DATETIME) AS fecha_modificacion`,
    googleDrive ? `r.[${googleDrive}] AS google_drive` : `CAST(NULL AS NVARCHAR(MAX)) AS google_drive`,
    googleDriveSentencia
      ? `r.[${googleDriveSentencia}] AS google_drive_sentencia`
      : `CAST(NULL AS NVARCHAR(MAX)) AS google_drive_sentencia`,
    numeroExpediente
      ? `r.[${numeroExpediente}] AS numero_expendiente`
      : `CAST(NULL AS NVARCHAR(100)) AS numero_expendiente`,
    idJuzgado ? `r.[${idJuzgado}] AS id_juzgado` : `CAST(NULL AS INT) AS id_juzgado`,
    nombre ? `d.[${nombre}] AS nombre` : `CAST('' AS NVARCHAR(200)) AS nombre`,
    apellido ? `d.[${apellido}] AS apellido` : `CAST('' AS NVARCHAR(200)) AS apellido`,
    tipoDocumento ? `d.[${tipoDocumento}] AS tipo_documento` : `CAST('' AS NVARCHAR(50)) AS tipo_documento`,
    numeroDocumento
      ? `d.[${numeroDocumento}] AS numero_documento`
      : `CAST('' AS NVARCHAR(50)) AS numero_documento`,
    calle ? `d.[${calle}] AS calle` : `CAST(NULL AS NVARCHAR(200)) AS calle`,
    numero ? `d.[${numero}] AS numero` : `CAST(NULL AS NVARCHAR(50)) AS numero`,
    piso ? `d.[${piso}] AS piso` : `CAST(NULL AS NVARCHAR(50)) AS piso`,
    depto ? `d.[${depto}] AS depto` : `CAST(NULL AS NVARCHAR(50)) AS depto`,
    idCiudad ? `d.[${idCiudad}] AS id_ciudad` : `CAST(NULL AS INT) AS id_ciudad`,
    telefono ? `d.[${telefono}] AS telefono` : `CAST('' AS NVARCHAR(100)) AS telefono`,
    email ? `d.[${email}] AS email` : `CAST('' AS NVARCHAR(200)) AS email`,
  ];

  return {
    reclamoId,
    sql: `
      SELECT *
      FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY r.[${fechaAlta || reclamoId}] ASC, r.[${reclamoId}] ASC) AS id_numerico,
               ${selectParts.join(',\n               ')}
        FROM ${qualified('reclamos')} r
        INNER JOIN ${qualified('denunciantes')} d ON d.[${dId}] = r.[${denuncianteFk}]
      ) mapped
      ORDER BY id_numerico ASC
    `,
  };
}

function mapRow(row, estados, ubicaciones, empresasMap) {
  const legacyGuid = String(row.id_reclamo);
  const id = Number(row.id_numerico);
  const estado = estados.get(row.id_caso_estado) ?? { descripcion: 'Consulta', idGrupoEstado: 1 };
  const ubicacion = ubicaciones.get(row.id_ciudad) ?? {
    ciudadId: row.id_ciudad ?? 0,
    ciudadNombre: '',
    provinciaId: 0,
    provinciaNombre: '',
  };
  const empresas = empresasMap.get(legacyGuid) ?? [];
  const nombre = trim(row.nombre);
  const apellido = trim(row.apellido);
  const numeroDocumento = trim(row.numero_documento);
  const createdAt = toIso(row.fecha_alta);
  const updatedAt = toIso(row.fecha_modificacion || row.fecha_alta);

  return {
    id,
    legacyGuid,
    denunciante: {
      nombre,
      apellido,
      tipoDocumento: trim(row.tipo_documento),
      numeroDocumento,
      calle: trim(row.calle) || undefined,
      numero: trim(row.numero) || undefined,
      piso: trim(row.piso) || undefined,
      depto: trim(row.depto) || undefined,
      provinciaId: ubicacion.provinciaId,
      ciudadId: ubicacion.ciudadId,
      provinciaNombre: ubicacion.provinciaNombre,
      ciudadNombre: ubicacion.ciudadNombre,
      telefono: trim(row.telefono),
      email: trim(row.email).toLowerCase(),
    },
    resumen: trim(row.resumen),
    hecho: trim(row.hecho),
    otrasEmpresas: trim(row.otras_empresas) || undefined,
    empresaIds: empresas.map((item) => item.id),
    empresas,
    googleDrive: trim(row.google_drive) || undefined,
    googleDriveSentencia: trim(row.google_drive_sentencia) || undefined,
    numeroExpediente: trim(row.numero_expendiente) || undefined,
    idJuzgado: row.id_juzgado ?? undefined,
    idCasoEstado: row.id_caso_estado ?? 1,
    estadoDescripcion: estado.descripcion,
    idGrupoEstado: estado.idGrupoEstado,
    idTipo: row.id_tipo ?? 1,
    esExterno: row.es_externo == null ? true : Boolean(row.es_externo),
    documentoSearch: numeroDocumento.replace(/\D/g, ''),
    nombreSearch: `${nombre} ${apellido}`.trim().toLowerCase(),
    createdAt,
    updatedAt,
    source: 'sql_v2',
  };
}

function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function writeFirestoreBatch(db, docs) {
  if (!docs.length) return;
  const batch = db.batch();
  for (const doc of docs) {
    batch.set(db.collection('reclamos').doc(String(doc.id)), stripUndefined(doc), { merge: true });
  }
  if (!dryRun) await batch.commit();
}

async function main() {
  const config = getReclamosSqlConfig();
  console.log(`Migración reclamos SQL → Firestore${dryRun ? ' (dry run)' : ''}`);
  console.log(`Origen: ${config.server}:${config.port}/${config.database}`);

  initFirebase();
  const db = admin.firestore();
  const pool = await sql.connect(config);

  const reclamoColumns = await loadColumns(pool, 'reclamos');
  const denuncianteColumns = await loadColumns(pool, 'denunciantes');
  const { reclamoId, sql: selectSql } = buildSelectQuery(reclamoColumns, denuncianteColumns);

  console.log('Cargando catálogos auxiliares…');
  const [estados, ubicaciones, empresasMap] = await Promise.all([
    loadEstados(pool),
    loadCiudadesProvincias(pool),
    loadEmpresasPorReclamo(pool),
  ]);

  const countResult = await pool.request().query(`SELECT COUNT(*) AS total FROM ${qualified('reclamos')}`);
  const total = countResult.recordset[0].total;
  console.log(`Reclamos en SQL: ${total}`);

  const result = await pool.request().query(selectSql);
  let rows = result.recordset;
  if (limit) rows = rows.slice(0, limit);

  console.log(`Procesando ${rows.length} reclamos…`);

  let processed = 0;
  let maxId = 0;
  let buffer = [];

  for (const row of rows) {
    const doc = mapRow(row, estados, ubicaciones, empresasMap);
    if (!Number.isFinite(doc.id) || doc.id <= 0) {
      throw new Error(`ID numérico inválido para reclamo ${doc.legacyGuid}`);
    }
    maxId = Math.max(maxId, doc.id);
    buffer.push(doc);
    processed += 1;

    if (buffer.length >= batchSize) {
      await writeFirestoreBatch(db, buffer);
      console.log(`Escritos ${processed}/${rows.length}`);
      buffer = [];
    }
  }

  if (buffer.length) {
    await writeFirestoreBatch(db, buffer);
    console.log(`Escritos ${processed}/${rows.length}`);
  }

  if (!dryRun) {
    await db.collection('migration_meta').doc('reclamos').set(
      {
        migratedAt: new Date().toISOString(),
        source: `${config.server}/${config.database}`,
        reclamosCount: rows.length,
        nextId: maxId + 1,
        sqlPrimaryKey: reclamoId,
      },
      { merge: true }
    );
  }

  await pool.close();
  console.log(`Listo. Importados: ${rows.length}. Próximo id sugerido: ${maxId + 1}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
