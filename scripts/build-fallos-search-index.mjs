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
const batchSize = Number(process.env.FALLOS_INDEX_BATCH || 400);

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

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchIndexDoc(fallo) {
  const demandadoNombres = [
    ...(fallo.demandadoEmpresas ?? []).map((e) => String(e.razon_social ?? '').trim()),
    ...(fallo.demandadoActores ?? []).map((e) => String(e.razon_social ?? '').trim()),
    ...(fallo.demandado ? [String(fallo.demandado).trim()] : []),
  ].filter(Boolean);

  const rubroNombres = (fallo.rubro ?? []).map((r) => String(r.nombre ?? '').trim()).filter(Boolean);
  const causaNombres = (fallo.causas ?? []).map((c) => String(c.nombre ?? '').trim()).filter(Boolean);
  const etiquetaNombres = (fallo.etiquetas ?? []).map((e) => String(e.nombre ?? '').trim()).filter(Boolean);
  const tipoJuicioNombre = fallo.tipoJuicio?.nombre?.trim() ?? null;
  const provinciaNombre = fallo.provincia?.nombre?.trim() ?? null;
  const ciudadNombre = fallo.ciudad?.nombre?.trim() ?? null;
  const juzgadoNombre = fallo.juzgado?.nombre?.trim() ?? null;
  const actor = String(fallo.actor ?? '').trim();

  const textoSearch = normalizeSearchText(
    [
      actor,
      fallo.demandado,
      ...demandadoNombres,
      fallo.resumen,
      ...rubroNombres,
      ...causaNombres,
      ...etiquetaNombres,
      tipoJuicioNombre,
      provinciaNombre,
      ciudadNombre,
      juzgadoNombre,
      fallo.patrimonial,
      fallo.moral,
      fallo.punitivo,
      fallo.divisa?.codigo,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const anonPreview = [
    `Fallo EXP. ${fallo.nroExpediente}`,
    actor ? `Actor: ${actor}` : null,
    demandadoNombres.length ? `Demandado: ${demandadoNombres.join('; ')}` : null,
    `Resumen: ${fallo.resumen}`,
    rubroNombres.length ? `Rubros: ${rubroNombres.join('; ')}` : null,
    causaNombres.length ? `Causas: ${causaNombres.join('; ')}` : null,
    tipoJuicioNombre ? `Tipo: ${tipoJuicioNombre}` : null,
    provinciaNombre ? `Provincia: ${provinciaNombre}` : null,
    juzgadoNombre ? `Tribunal: ${juzgadoNombre}` : null,
    `Fecha: ${fallo.fecha}`,
    fallo.patrimonial !== '0' || fallo.moral !== '0' || fallo.punitivo !== '0'
      ? `Montos: patrimonial ${fallo.patrimonial}, moral ${fallo.moral}, punitivo ${fallo.punitivo} ${fallo.divisa?.codigo ?? ''}`.trim()
      : null,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    id: fallo.nroExpediente,
    actor,
    demandado: fallo.demandado ?? null,
    demandadoNombres,
    demandadoEmpresaIds: fallo.demandadoEmpresaIds ?? [],
    demandadoSearch: normalizeSearchText(demandadoNombres.join(' ')),
    actorSearch: normalizeSearchText(actor),
    rubroIds: fallo.rubroIds ?? [],
    rubroNombres,
    causaIds: fallo.causaIds ?? [],
    causaNombres,
    etiquetaIds: fallo.etiquetaIds ?? [],
    etiquetaNombres,
    resumen: String(fallo.resumen ?? '').trim(),
    textoSearch,
    tipoJuicioId: fallo.tipoJuicioId ?? null,
    tipoJuicioNombre,
    provinciaId: fallo.provinciaId ?? null,
    provinciaNombre,
    ciudadId: fallo.ciudadId ?? null,
    ciudadNombre,
    juzgadoId: fallo.juzgadoId ?? null,
    juzgadoNombre,
    fecha: fallo.fecha,
    fechaSort: fallo.fechaSort,
    patrimonial: fallo.patrimonial,
    moral: fallo.moral,
    punitivo: fallo.punitivo,
    divisaCodigo: fallo.divisa?.codigo ?? null,
    status: fallo.status ?? 'publish',
    createdAt: fallo.createdAt,
    updatedAt: fallo.updatedAt,
    anonPreview,
    indexedAt: new Date().toISOString(),
  };
}

async function main() {
  initFirebase();
  const db = admin.firestore();

  console.log('Cargando fallos desde Firestore…');
  const snap = await db.collection('fallos').get();
  const fallos = snap.docs
    .map((doc) => doc.data())
    .filter((item) => !item.deletedAt);

  console.log(`Fallos a indexar: ${fallos.length}`);

  if (dryRun) {
    console.log('Dry run — no se escribió nada.');
    return;
  }

  let processed = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const fallo of fallos) {
    const indexDoc = buildSearchIndexDoc(fallo);
    batch.set(db.collection('fallos_busqueda').doc(String(fallo.nroExpediente)), indexDoc);
    batchCount += 1;
    processed += 1;

    if (batchCount >= batchSize) {
      await batch.commit();
      console.log(`Indexados ${processed}/${fallos.length}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount) {
    await batch.commit();
    console.log(`Indexados ${processed}/${fallos.length}`);
  }

  const indexedAt = new Date().toISOString();
  await db.collection('migration_meta').doc('fallos_search_index').set(
    {
      indexedAt,
      count: processed,
      source: 'fallos',
    },
    { merge: true }
  );

  console.log(`Índice listo: ${processed} documentos (${indexedAt})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
