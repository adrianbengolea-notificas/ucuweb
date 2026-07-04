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
const onlyFallos = args.includes('--only-fallos');
const onlyCatalogs = args.includes('--only-catalogs');
const apiUrl = (
  process.env.OBSERVATORIO_API_URL ||
  'https://vps-3844415-x.dattaweb.com/observatorio-api'
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

async function apiFetch(pathname, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const url = `${apiUrl}/${pathname.replace(/^\//, '')}${suffix}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`API ${response.status} en ${url}`);
  }
  return response.json();
}

function parseFechaSort(fecha) {
  const parts = String(fecha || '').trim().split('/');
  if (parts.length !== 3) return new Date(0).toISOString();
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return new Date(0).toISOString();
  return new Date(year, month - 1, day).toISOString();
}

function normalizeFallo(fallo) {
  return {
    ...fallo,
    files: (fallo.files || []).map((file) => ({
      ...file,
      url: (() => {
        const trimmed = String(file.url || '').trim();
        const match = trimmed.match(/\/observatorio\/fallos\/(\d+)\/([^/?#]+)/);
        if (match) return `/observatorio/fallos/${match[1]}/${match[2]}`;
        if (file.file && fallo.nroExpediente) {
          return `/observatorio/fallos/${fallo.nroExpediente}/${file.file}`;
        }
        return trimmed;
      })(),
    })),
    status: 'publish',
    actorSearch: String(fallo.actor || '').trim().toLowerCase(),
    rubroIds: (fallo.rubro || []).map((item) => item.id),
    causaIds: (fallo.causas || []).map((item) => item.id),
    etiquetaIds: (fallo.etiquetas || []).map((item) => item.id),
    demandadoEmpresaIds: (fallo.demandadoEmpresas || []).map((item) => item.id),
    tipoJuicioId: fallo.tipoJuicio?.id ?? null,
    provinciaId: fallo.provincia?.id ?? null,
    ciudadId: fallo.ciudad?.id ?? null,
    juzgadoId: fallo.juzgado?.id ?? null,
    fechaSort: parseFechaSort(fallo.fecha),
  };
}

async function fetchAllFallos() {
  const ids = new Set();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await apiFetch('api/fallo/', { page, offset: 50 });
    totalPages = response.totalPages;
    for (const item of response.data || []) {
      if (!item.deletedAt) ids.add(item.nroExpediente);
    }
    console.log(`IDs página ${page}/${totalPages} (${ids.size} acumulados)`);
    page += 1;
  }

  const all = [];
  const idList = [...ids];
  const concurrency = 8;
  let index = 0;

  async function worker() {
    while (index < idList.length) {
      const current = index;
      index += 1;
      const id = idList[current];
      const fallo = await apiFetch(`api/fallo/${id}`);
      all.push(fallo);
      if ((current + 1) % 25 === 0 || current + 1 === idList.length) {
        console.log(`Detalle ${current + 1}/${idList.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  all.sort((a, b) => b.nroExpediente - a.nroExpediente);
  return all;
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
  }
}

async function migrateCatalogs(db) {
  console.log('Descargando catálogos…');
  const [rubros, provincias, tiposJuicio, reclamos, etiquetas, empresas, divisasRaw] =
    await Promise.all([
    apiFetch('api/datos/rubros'),
    apiFetch('api/datos/provincias'),
    apiFetch('api/datos/tipojuicio'),
    apiFetch('api/datos/reclamos'),
    apiFetch('api/datos/etiquetas'),
    apiFetch('api/datos/empresas'),
    apiFetch('api/datos/divisas'),
  ]);

  const divisas = divisasRaw.map((item) => ({
    id: item.id,
    codigo: item.codigoDivisa ?? item.codigo ?? '',
    nombre: item.nombreDivisa ?? item.nombre ?? '',
    pais: item.pais ?? '',
  }));

  const ciudades = [];
  for (const provincia of provincias) {
    const items = await apiFetch('api/datos/ciudades', { idProvincia: provincia.id });
    ciudades.push(...items.map((item) => ({ ...item, idProvincia: provincia.id })));
    console.log(`Ciudades ${provincia.nombre}: ${items.length}`);
  }

  if (dryRun) {
    console.log('DRY RUN catálogos:', {
      rubros: rubros.length,
      provincias: provincias.length,
      ciudades: ciudades.length,
      tiposJuicio: tiposJuicio.length,
      reclamos: reclamos.length,
      etiquetas: etiquetas.length,
      empresas: empresas.length,
      divisas: divisas.length,
    });
    return;
  }

  await writeBatch(db, 'observatorio_rubros', rubros, (item) => item);
  await writeBatch(db, 'observatorio_provincias', provincias, (item) => item);
  await writeBatch(db, 'observatorio_tipos_juicio', tiposJuicio, (item) => ({
    id: item.id,
    nombre: item.description ?? item.nombre ?? '',
    description: item.description ?? item.nombre ?? '',
  }));
  await writeBatch(db, 'observatorio_reclamos', reclamos, (item) => item);
  await writeBatch(db, 'observatorio_etiquetas', etiquetas, (item) => item);
  await writeBatch(db, 'observatorio_empresas', empresas, (item) => item);
  await writeBatch(db, 'observatorio_divisas', divisas, (item) => item);
  await writeBatch(db, 'observatorio_ciudades', ciudades, (item) => item);
  console.log('Catálogos escritos en Firestore.');
}

async function migrateFallos(db, fallos) {
  const juzgados = new Map();

  for (const fallo of fallos) {
    if (fallo.juzgado?.id) {
      juzgados.set(fallo.juzgado.id, {
        id: fallo.juzgado.id,
        nombre: fallo.juzgado.nombre,
        idCiudad: fallo.ciudad?.id ?? null,
      });
    }
  }

  const ciudadesConJuzgados = new Set(
    fallos.map((fallo) => fallo.ciudad?.id).filter(Boolean)
  );
  for (const idCiudad of ciudadesConJuzgados) {
    try {
      const items = await apiFetch('api/datos/juzgados', { idCiudad });
      for (const item of items) {
        juzgados.set(item.id, { ...item, idCiudad });
      }
    } catch (error) {
      console.warn(`No se pudieron cargar juzgados de ciudad ${idCiudad}:`, error.message);
    }
  }

  if (dryRun) {
    console.log(`DRY RUN fallos: ${fallos.length}, juzgados detectados: ${juzgados.size}`);
    return Math.max(...fallos.map((item) => item.nroExpediente), 0);
  }

  const batchSize = 400;
  for (let index = 0; index < fallos.length; index += batchSize) {
    const batch = db.batch();
    for (const fallo of fallos.slice(index, index + batchSize)) {
      const payload = normalizeFallo(fallo);
      batch.set(db.collection('fallos').doc(String(payload.nroExpediente)), payload, { merge: true });
    }
    await batch.commit();
    console.log(`Fallos escritos: ${Math.min(index + batchSize, fallos.length)}/${fallos.length}`);
  }

  await writeBatch(db, 'observatorio_juzgados', [...juzgados.values()], (item) => item);

  return Math.max(...fallos.map((item) => item.nroExpediente), 0);
}

async function main() {
  console.log(`Migración observatorio → Firestore${dryRun ? ' (dry run)' : ''}`);
  console.log(`API origen: ${apiUrl}`);

  initFirebase();
  const db = admin.firestore();

  if (onlyCatalogs) {
    await migrateCatalogs(db);
    console.log('Listo. Solo catálogos migrados.');
    return;
  }

  const fallos = await fetchAllFallos();
  if (!onlyFallos) {
    await migrateCatalogs(db);
  } else {
    console.log('Omitiendo catálogos (--only-fallos)');
  }
  const maxExpediente = await migrateFallos(db, fallos);

  if (!dryRun) {
    await db.collection('migration_meta').doc('observatorio').set(
      {
        migratedAt: new Date().toISOString(),
        source: apiUrl,
        fallosCount: fallos.length,
        nextExpediente: maxExpediente,
      },
      { merge: true }
    );
  }

  console.log(`Listo. Fallos migrados: ${fallos.length}. Próximo expediente: ${maxExpediente + 1}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
