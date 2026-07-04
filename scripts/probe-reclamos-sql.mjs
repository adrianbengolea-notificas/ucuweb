#!/usr/bin/env node
import sql from 'mssql';
import { getReclamosSqlConfig, qualified, schemaName } from './lib/reclamos-sql-config.mjs';

const tables = [
  'reclamos',
  'denunciantes',
  'reclamos_empresas',
  'empresas',
  'historico_reclamos_estados',
  'casos_estados',
];

async function main() {
  const config = getReclamosSqlConfig();
  console.log(`Conectando a ${config.server}:${config.port}/${config.database}…`);

  const pool = await sql.connect(config);
  console.log('Conexión OK.\n');

  for (const table of tables) {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total
      FROM ${qualified(table)}
    `);
    console.log(`${table}: ${result.recordset[0].total}`);
  }

  console.log('\nColumnas:');
  for (const table of tables) {
    const columns = await pool
      .request()
      .input('table', sql.NVarChar, table)
      .input('schema', sql.NVarChar, schemaName())
      .query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION
    `);
    console.log(`\n[${schemaName()}].[${table}]`);
    for (const col of columns.recordset) {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    }
  }

  const sample = await pool.request().query(`
    SELECT TOP 1 *
    FROM ${qualified('reclamos')}
    ORDER BY 1 DESC
  `);
  console.log('\nMuestra reclamo (columnas con valor):');
  console.log(sample.recordset[0]);

  await pool.close();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
