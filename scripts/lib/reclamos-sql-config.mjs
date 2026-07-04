import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

export function getReclamosSqlConfig() {
  const server = process.env.RECLAMOS_SQL_SERVER || '200.58.120.182';
  const port = Number(process.env.RECLAMOS_SQL_PORT || 1433);
  const database = process.env.RECLAMOS_SQL_DATABASE || 'v0021348_ucu_v2';
  const user = process.env.RECLAMOS_SQL_USER || 'v0021348_ucu_v2';
  const password = process.env.RECLAMOS_SQL_PASSWORD;

  if (!password) {
    throw new Error(
      'Falta RECLAMOS_SQL_PASSWORD en .env.local (contraseña de v0021348_ucu_v2).'
    );
  }

  return {
    server,
    port,
    database,
    user,
    password,
    options: {
      encrypt: process.env.RECLAMOS_SQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.RECLAMOS_SQL_TRUST_CERT !== 'false',
    },
    connectionTimeout: 30_000,
    requestTimeout: 120_000,
  };
}

export function schemaName() {
  return process.env.RECLAMOS_SQL_SCHEMA || 'con';
}

export function qualified(table) {
  return `[${schemaName()}].[${table}]`;
}
