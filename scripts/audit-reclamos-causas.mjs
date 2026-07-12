#!/usr/bin/env node
/**
 * Audita causas de reclamos en SQL vs lo esperado.
 * Uso: node scripts/audit-reclamos-causas.mjs [--id=1447] [--nombre=GURRIERI]
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { getReclamosSqlConfig, qualified } from './lib/reclamos-sql-config.mjs';
import { loadColumns, pickColumn } from './lib/reclamos-sync-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const args = process.argv.slice(2);
const idArg = args.find((a) => a.startsWith('--id='));
const nombreArg = args.find((a) => a.startsWith('--nombre='));
const targetId = idArg ? Number(idArg.split('=')[1]) : null;
const targetNombre = nombreArg ? nombreArg.split('=')[1] : 'GURRIERI';

async function analyzeCausaQuality(pool) {
  console.log('\n=== ANÁLISIS CALIDAD CAUSAS ===');

  const q1 = await pool.request().query(`
    SELECT 
      SUM(CASE WHEN r.resumen LIKE '%plan%' OR r.resumen LIKE '%ahorro%' OR r.hecho LIKE '%plan de ahorro%' OR r.hecho LIKE '%plan de ahorro%' THEN 1 ELSE 0 END) AS parece_plan_ahorro,
      SUM(CASE WHEN r.resumen LIKE '%pasaje%' OR r.hecho LIKE '%pasaje%' OR r.hecho LIKE '%vuelo%' OR r.hecho LIKE '%aerol%' OR r.hecho LIKE '%transporte%' THEN 1 ELSE 0 END) AS parece_transporte,
      COUNT(*) AS total_causa_30
    FROM ${qualified('reclamos_causas')} rc
    INNER JOIN ${qualified('reclamos')} r ON r.id_reclamo = rc.id_reclamo
    WHERE rc.id_causa = 30 AND rc.activo = 1
  `);
  console.log('Causa 30 (pasaje) por contexto del texto:', q1.recordset[0]);

  const q2 = await pool.request().query(`
    SELECT COUNT(*) AS huerfanas
    FROM ${qualified('reclamos_causas')} rc
    LEFT JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa AND c.activo = 1
    WHERE rc.activo = 1 AND c.id_causa IS NULL
  `);
  console.log('Filas reclamos_causas con id_causa inexistente/inactivo:', q2.recordset[0]);

  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'con' AND (TABLE_NAME LIKE '%rubr%' OR TABLE_NAME LIKE '%causa%')
    ORDER BY TABLE_NAME
  `);
  console.log('Tablas:', tables.recordset.map((r) => r.TABLE_NAME).join(', '));

  try {
    const rubroCols = await loadColumns(pool, 'rubros');
    console.log('rubros cols:', rubroCols.map((c) => c.COLUMN_NAME).join(', '));
    const empCols = await loadColumns(pool, 'empresas');
    const rubroFk = empCols.find((c) => c.COLUMN_NAME.toLowerCase().includes('rubr'));
    console.log('empresas rubro col:', rubroFk?.COLUMN_NAME);
    if (rubroFk) {
      const sample = await pool.request().query(`
        SELECT TOP 5 e.nombre, r.descripcion AS rubro
        FROM ${qualified('empresas')} e
        LEFT JOIN ${qualified('rubros')} r ON r.id_rubro = e.[${rubroFk.COLUMN_NAME}]
        WHERE e.nombre LIKE '%FCA%' OR e.nombre LIKE '%FIAT%'
      `);
      console.log('FCA rubro:', sample.recordset);
    }
  } catch (e) {
    console.log('rubros:', e.message);
  }

  const q3 = await pool.request().query(`
    SELECT TOP 15 c.id_causa, c.descripcion, COUNT(*) AS cnt
    FROM ${qualified('reclamos_causas')} rc
    INNER JOIN ${qualified('reclamos')} r ON r.id_reclamo = rc.id_reclamo
    INNER JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa
    INNER JOIN ${qualified('reclamos_empresas')} re ON re.id_reclamo = r.id_reclamo
    INNER JOIN ${qualified('empresas')} e ON e.id_empresa = re.id_empresa
    WHERE rc.activo = 1 AND (e.nombre LIKE '%AHORRO%' OR e.nombre LIKE '%PLAN%')
    GROUP BY c.id_causa, c.descripcion
    ORDER BY cnt DESC
  `);
  console.log('\nCausas más usadas en empresas PLAN/AHORRO:');
  for (const row of q3.recordset) console.log(`  ${row.cnt}x [${row.id_causa}] ${row.descripcion}`);

  const rubros = await pool.request().query(`
    SELECT id_rubro, descripcion FROM ${qualified('rubros')} WHERE activo = 1 ORDER BY descripcion
  `);
  console.log('\nRubros activos:');
  for (const r of rubros.recordset) console.log(`  ${r.id_rubro}: ${r.descripcion}`);

  const cr = await pool.request().query(`
    SELECT r.descripcion AS rubro, c.id_causa, c.descripcion AS causa
    FROM ${qualified('causas_rubros')} cr
    JOIN ${qualified('rubros')} r ON r.id_rubro = cr.id_rubro
    JOIN ${qualified('causas')} c ON c.id_causa = cr.id_causa
    WHERE c.id_causa IN (30, 48, 55, 80, 98, 90, 47) AND c.activo = 1
    ORDER BY r.descripcion, c.id_causa
  `);
  console.log('\nCausas clave por rubro (muestra):');
  let lastRubro = '';
  for (const row of cr.recordset) {
    if (row.rubro !== lastRubro) {
      console.log(`\n  ${row.rubro}:`);
      lastRubro = row.rubro;
    }
    console.log(`    [${row.id_causa}] ${row.causa}`);
  }

  const er = await pool.request().query(`
    SELECT e.nombre, r.descripcion AS rubro
    FROM ${qualified('empresas_rubros')} er
    JOIN ${qualified('empresas')} e ON e.id_empresa = er.id_empresa
    JOIN ${qualified('rubros')} r ON r.id_rubro = er.id_rubro
    WHERE e.nombre LIKE '%FCA SA DE AHORRO%' OR e.nombre LIKE '%VOLKSWAGEN SA DE AHORRO%'
  `);
  console.log('\nRubros asignados a FCA/VW plan:');
  for (const row of er.recordset) console.log(`  ${row.nombre} → ${row.rubro}`);

  const q4 = await pool.request().query(`
    SELECT COUNT(*) AS mal_asignadas
    FROM ${qualified('reclamos_causas')} rc
    INNER JOIN ${qualified('reclamos')} r ON r.id_reclamo = rc.id_reclamo
    INNER JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa AND c.activo = 1
    INNER JOIN ${qualified('reclamos_empresas')} re ON re.id_reclamo = r.id_reclamo
    INNER JOIN ${qualified('empresas_rubros')} er ON er.id_empresa = re.id_empresa
    LEFT JOIN ${qualified('causas_rubros')} valid ON valid.id_causa = rc.id_causa AND valid.id_rubro = er.id_rubro
    WHERE rc.activo = 1 AND valid.id_causa IS NULL
  `);
  console.log('\nCausas que NO pertenecen al rubro de la empresa:', q4.recordset[0]);
}

async function main() {
  const pool = await sql.connect(getReclamosSqlConfig());

  console.log('=== Estructura reclamos_causas ===');
  const rcCols = await loadColumns(pool, 'reclamos_causas');
  for (const col of rcCols) console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE})`);

  console.log('\n=== Muestra reclamos_causas (5 filas) ===');
  const sample = await pool.request().query(`
    SELECT TOP 5 rc.*, c.descripcion AS causa_desc
    FROM ${qualified('reclamos_causas')} rc
    LEFT JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa
  `);
  console.log(sample.recordset);

  console.log('\n=== Catálogo causas (id + descripcion) ===');
  const causas = await pool.request().query(`
    SELECT id_causa, descripcion, activo FROM ${qualified('causas')} ORDER BY id_causa
  `);
  for (const c of causas.recordset) {
    console.log(`  ${c.id_causa}: ${c.descripcion} (activo=${c.activo})`);
  }

  const reclamoColumns = await loadColumns(pool, 'reclamos');
  const denuncianteColumns = await loadColumns(pool, 'denunciantes');
  const reclamoId = pickColumn(reclamoColumns, ['id_reclamo', 'id']);
  const denuncianteFk = pickColumn(reclamoColumns, ['id_denunciante', 'denunciante_id']);
  const dId = pickColumn(denuncianteColumns, ['id_denunciante', 'id']);
  const dNombre = pickColumn(denuncianteColumns, ['nombre']);
  const dApellido = pickColumn(denuncianteColumns, ['apellido']);
  const resumen = pickColumn(reclamoColumns, ['resumen']);
  const idTipo = pickColumn(reclamoColumns, ['id_tipo', 'id_tipo_reclamo']);

  console.log('\n=== Columnas reclamos relevantes ===');
  console.log({ reclamoId, denuncianteFk, idTipo, resumen });

  if (targetNombre) {
    console.log(`\n=== Búsqueda por apellido: ${targetNombre} ===`);
    const q = await pool.request().input('nombre', sql.NVarChar, `%${targetNombre}%`).query(`
      SELECT TOP 10
        mapped.id_numerico,
        r.[${reclamoId}] AS id_reclamo,
        d.[${dApellido}] AS apellido,
        d.[${dNombre}] AS nombre,
        ${resumen ? `r.[${resumen}] AS resumen` : 'NULL AS resumen'},
        ${idTipo ? `r.[${idTipo}] AS id_tipo` : 'NULL AS id_tipo'}
      FROM ${qualified('reclamos')} r
      INNER JOIN ${qualified('denunciantes')} d ON d.[${dId}] = r.[${denuncianteFk}]
      INNER JOIN (
        SELECT ROW_NUMBER() OVER (ORDER BY r2.[${reclamoId}] ASC) AS id_numerico, r2.[${reclamoId}] AS rid
        FROM ${qualified('reclamos')} r2
        INNER JOIN ${qualified('denunciantes')} d2 ON d2.[${dId}] = r2.[${denuncianteFk}]
      ) mapped ON mapped.rid = r.[${reclamoId}]
      WHERE d.[${dApellido}] LIKE @nombre OR d.[${dNombre}] LIKE @nombre
      ORDER BY mapped.id_numerico DESC
    `);
    console.log(q.recordset);

    for (const row of q.recordset) {
      const guid = String(row.id_reclamo).toUpperCase();
      const causasRow = await pool.request().input('guid', sql.NVarChar, guid).query(`
        SELECT rc.id_causa, c.descripcion, rc.activo, rc.*
        FROM ${qualified('reclamos_causas')} rc
        INNER JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa
        WHERE UPPER(CAST(rc.id_reclamo AS NVARCHAR(50))) = @guid
      `);
      const empresasRow = await pool.request().input('guid', sql.NVarChar, guid).query(`
        SELECT e.nombre FROM ${qualified('reclamos_empresas')} re
        INNER JOIN ${qualified('empresas')} e ON e.id_empresa = re.id_empresa
        WHERE UPPER(CAST(re.id_reclamo AS NVARCHAR(50))) = @guid
      `);
      console.log(`\n--- Reclamo #${row.id_numerico} (${row.nombre} ${row.apellido}) ---`);
      console.log('GUID:', guid);
      console.log('Resumen:', row.resumen);
      console.log('id_tipo:', row.id_tipo);
      console.log('Empresas:', empresasRow.recordset.map((e) => e.nombre));
      console.log('Causas SQL:', causasRow.recordset);
    }
  }

  if (targetId) {
    console.log(`\n=== Reclamo id numérico ${targetId} ===`);
    const fechaAlta = pickColumn(reclamoColumns, ['fecha_alta', 'fecha', 'created_at']);
    const mapped = await pool.request().input('id', sql.Int, targetId).query(`
      SELECT id_numerico, id_reclamo FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY r.[${fechaAlta || reclamoId}] ASC, r.[${reclamoId}] ASC) AS id_numerico,
               r.[${reclamoId}] AS id_reclamo
        FROM ${qualified('reclamos')} r
        INNER JOIN ${qualified('denunciantes')} d ON d.[${dId}] = r.[${denuncianteFk}]
      ) x WHERE id_numerico = @id
    `);
    const row = mapped.recordset[0];
    if (row) {
      const guid = String(row.id_reclamo).toUpperCase();
      const causasRow = await pool.request().input('guid', sql.NVarChar, guid).query(`
        SELECT rc.*, c.descripcion FROM ${qualified('reclamos_causas')} rc
        INNER JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa
        WHERE UPPER(CAST(rc.id_reclamo AS NVARCHAR(50))) = @guid
      `);
      console.log({ guid, causas: causasRow.recordset });
    }
  }

  console.log('\n=== FCA + PASAJE en SQL (reclamos con 1 empresa FCA) ===');
  const fcaPasaje = await pool.request().query(`
    WITH single_fca AS (
      SELECT UPPER(CAST(re.id_reclamo AS NVARCHAR(50))) AS guid
      FROM ${qualified('reclamos_empresas')} re
      INNER JOIN ${qualified('empresas')} e ON e.id_empresa = re.id_empresa
      WHERE e.nombre LIKE '%FCA%' OR e.nombre LIKE '%FIAT PLAN%'
      GROUP BY re.id_reclamo
      HAVING COUNT(*) = 1
    )
    SELECT COUNT(DISTINCT rc.id_reclamo) AS total
    FROM ${qualified('reclamos_causas')} rc
    INNER JOIN ${qualified('causas')} c ON c.id_causa = rc.id_causa
    INNER JOIN single_fca sf ON UPPER(CAST(rc.id_reclamo AS NVARCHAR(50))) = sf.guid
    WHERE c.descripcion LIKE '%PASAJE%' AND rc.activo = 1
  `);
  console.log('FCA única + causa PASAJE:', fcaPasaje.recordset[0]);

  console.log('\n=== Tipos de reclamo (si existe id_tipo) ===');
  if (idTipo) {
    const tipos = await pool.request().query(`
      SELECT tr.id_tipo_reclamo, tr.descripcion, COUNT(*) AS cnt
      FROM ${qualified('reclamos')} r
      INNER JOIN ${qualified('tipos_reclamos')} tr ON tr.id_tipo_reclamo = r.[${idTipo}]
      GROUP BY tr.id_tipo_reclamo, tr.descripcion
      ORDER BY cnt DESC
    `);
    console.log(tipos.recordset);
  }

  await analyzeCausaQuality(pool);

  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
