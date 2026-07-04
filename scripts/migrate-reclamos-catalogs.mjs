#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fetchEmpresas = args.includes('--fetch-empresas');
const sqlArgIndex = args.findIndex((arg) => arg === '--sql');
const sqlPath =
  (sqlArgIndex >= 0 ? args[sqlArgIndex + 1] : null) ||
  process.env.RECLAMOS_SQL_PATH ||
  path.join(rootDir, 'imports', 'reclamos', 'ucu.sql');

const RECLAMOS_SITE_URL = (
  process.env.RECLAMOS_SITE_URL || 'https://consumidoresprotegidos.com.ar'
).replace(/\/$/, '');

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
    throw new Error(
      'Faltan credenciales Firebase Admin. Completá .env.local o GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function readSqlFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString('utf16le');
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf8');
  }
  return buffer.toString('utf8');
}

function parseSqlValue(raw) {
  const value = raw.trim();
  if (value === 'NULL') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('N\'') || value.startsWith('\'')) {
    const inner = value.startsWith('N') ? value.slice(2, -1) : value.slice(1, -1);
    return inner.replace(/''/g, "'");
  }
  return value;
}

function parseInsertLine(line, table) {
  const prefix = `INSERT [con].[${table}]`;
  if (!line.startsWith(prefix)) return null;

  const columnsMatch = line.match(/INSERT \[con\]\.\[[^\]]+\] \(([^)]+)\) VALUES \((.+)\)$/);
  if (!columnsMatch) return null;

  const columns = columnsMatch[1].split(',').map((col) => col.trim().replace(/^\[|\]$/g, ''));
  const values = splitSqlValues(columnsMatch[2]);

  const row = {};
  columns.forEach((column, index) => {
    row[column] = parseSqlValue(values[index] ?? 'NULL');
  });
  return row;
}

function splitSqlValues(valuePart) {
  const values = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < valuePart.length; i += 1) {
    const char = valuePart[i];
    const next = valuePart[i + 1];

    if (!inString && (char === 'N' && next === "'")) {
      inString = true;
      current += "N'";
      i += 1;
      continue;
    }

    if (!inString && char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (inString && char === "'" && next === "'") {
      current += "''";
      i += 1;
      continue;
    }

    if (inString && char === "'") {
      inString = false;
      current += char;
      continue;
    }

    if (!inString && char === ',') {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) values.push(current.trim());
  return values;
}

function parseSqlTable(sql, table) {
  const rows = [];
  for (const line of sql.split(/\r?\n/)) {
    const row = parseInsertLine(line.trim(), table);
    if (row) rows.push(row);
  }
  return rows;
}

async function writeBatch(db, collection, items, mapItem) {
  if (!items.length) return;
  const batchSize = 400;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = db.batch();
    for (const item of items.slice(index, index + batchSize)) {
      const payload = mapItem(item);
      batch.set(db.collection(collection).doc(String(payload.id)), payload, { merge: true });
    }
    if (!dryRun) await batch.commit();
    console.log(`${collection}: ${Math.min(index + batchSize, items.length)}/${items.length}`);
  }
}

async function fetchEmpresasFromSite() {
  console.log(`Descargando empresas desde ${RECLAMOS_SITE_URL}…`);
  const response = await fetch(`${RECLAMOS_SITE_URL}/Admin/Reclamos/CreatePublic`, {
    headers: { Accept: 'text/html' },
  });
  if (!response.ok) {
    throw new Error(`No se pudo descargar el formulario (${response.status})`);
  }

  const html = await response.text();
  const options = [...html.matchAll(/<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi)];
  const empresas = [];

  for (const match of options) {
    const id = Number(match[1]);
    if (!id) continue;
    const label = match[2]
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&amp;/g, '&')
      .trim();
    const [cuitPart, ...nameParts] = label.split(' - ');
    const cuit = cuitPart?.trim() || null;
    const nombre = (nameParts.length ? nameParts.join(' - ') : label).trim();
    empresas.push({
      id,
      nombre,
      nombreSearch: nombre.toLowerCase(),
      cuit: cuit === 'XXXXXXXXXXX' ? null : cuit,
      activo: true,
    });
  }

  const unique = new Map();
  for (const item of empresas) unique.set(item.id, item);
  return [...unique.values()];
}

async function migrateCatalogs(db, sql) {
  const estadosRaw = parseSqlTable(sql, 'casos_estados');
  const gruposRaw = parseSqlTable(sql, 'casos_grupos_estados');
  const provinciasRaw = parseSqlTable(sql, 'provincias');
  const ciudadesRaw = parseSqlTable(sql, 'ciudades');
  const rubrosRaw = parseSqlTable(sql, 'rubros');
  const empresasSqlRaw = parseSqlTable(sql, 'empresas');

  let empresas = empresasSqlRaw.map((row) => ({
    id: row.id_empresa,
    nombre: String(row.nombre || '').trim(),
    nombreSearch: String(row.nombre || '').trim().toLowerCase(),
    cuit: row.cuit ? String(row.cuit).trim() : null,
    activo: Boolean(row.activo),
  }));

  if (fetchEmpresas) {
    empresas = await fetchEmpresasFromSite();
  }

  const estados = estadosRaw.map((row) => ({
    id: row.id_caso_estado,
    descripcion: String(row.descripcion || '').trim(),
    idGrupoEstado: row.id_caso_grupo_estado,
    activo: row.activo == null ? true : Boolean(row.activo),
  }));

  const grupos = gruposRaw.map((row) => ({
    id: row.id_caso_grupo_estado,
    descripcion: String(row.descripcion || '').trim(),
    estado: String(row.estado || '').trim(),
    activo: row.activo == null ? true : Boolean(row.activo),
  }));

  const provincias = provinciasRaw.map((row) => ({
    id: row.id_provincia,
    nombre: String(row.nombre || '').trim(),
    activo: row.activo == null ? true : Boolean(row.activo),
  }));

  const ciudades = ciudadesRaw.map((row) => ({
    id: row.id_ciudad,
    nombre: String(row.nombre || '').trim(),
    codigoPostal: Number(row.codigo_postal || 0),
    idProvincia: row.id_provincia,
    activo: row.activo == null ? true : Boolean(row.activo),
  }));

  const rubros = rubrosRaw.map((row) => ({
    id: row.id_rubro,
    descripcion: String(row.descripcion || '').trim(),
    activo: Boolean(row.activo),
  }));

  console.log('Resumen catálogos:', {
    estados: estados.length,
    grupos: grupos.length,
    provincias: provincias.length,
    ciudades: ciudades.length,
    rubros: rubros.length,
    empresas: empresas.length,
  });

  if (dryRun) return;

  await writeBatch(db, 'reclamos_estados', estados, (item) => item);
  await writeBatch(db, 'reclamos_grupos_estados', grupos, (item) => item);
  await writeBatch(db, 'reclamos_provincias', provincias, (item) => item);
  await writeBatch(db, 'reclamos_ciudades', ciudades, (item) => item);
  await writeBatch(db, 'reclamos_rubros', rubros, (item) => item);
  if (empresas.length) {
    await writeBatch(db, 'reclamos_empresas', empresas, (item) => item);
  }

  await db.collection('migration_meta').doc('reclamos_catalogs').set(
    {
      migratedAt: new Date().toISOString(),
      sourceSql: path.basename(sqlPath),
      estadosCount: estados.length,
      ciudadesCount: ciudades.length,
      empresasCount: empresas.length,
      empresasSource: fetchEmpresas ? RECLAMOS_SITE_URL : 'ucu.sql',
    },
    { merge: true }
  );

  await db.collection('migration_meta').doc('reclamos').set(
    {
      nextId: 1,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function main() {
  console.log(`Migración catálogos reclamos → Firestore${dryRun ? ' (dry run)' : ''}`);

  if (!fs.existsSync(sqlPath)) {
    throw new Error(
      `No se encontró ${sqlPath}. Copiá ucu.sql a imports/reclamos/ucu.sql o usá --sql <ruta>.`
    );
  }

  const sql = readSqlFile(sqlPath);
  initFirebase();
  const db = admin.firestore();
  await migrateCatalogs(db, sql);
  console.log('Listo.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
