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
const batchSize = Number(process.env.RECLAMOS_INDEX_BATCH || 400);

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

function buildSearchIndexDoc(reclamo) {
  const empresaNombres = [
    ...(reclamo.empresas ?? []).map((e) => String(e.nombre ?? '').trim()),
    ...(reclamo.otrasEmpresas ? [String(reclamo.otrasEmpresas).trim()] : []),
  ].filter(Boolean);

  const causaTextos = (reclamo.causas ?? [])
    .map((c) => String(c.descripcion ?? '').trim())
    .filter(Boolean);
  const hechoPreview = String(reclamo.hecho ?? '').trim().slice(0, 400);
  const estadoDescripcion = String(reclamo.estadoDescripcion ?? 'Consulta').trim();

  const textoSearch = normalizeSearchText(
    [
      reclamo.resumen,
      reclamo.hecho,
      ...empresaNombres,
      ...causaTextos,
      estadoDescripcion,
      reclamo.denunciante?.provinciaNombre,
      reclamo.denunciante?.ciudadNombre,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const anonPreview = [
    `Reclamo #${reclamo.id}`,
    `Empresas: ${empresaNombres.join('; ') || '—'}`,
    `Estado: ${estadoDescripcion}`,
    `Resumen: ${reclamo.resumen}`,
    causaTextos.length ? `Causas: ${causaTextos.join('; ')}` : null,
    `Registrado: ${String(reclamo.createdAt ?? '').slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    id: reclamo.id,
    empresaIds: reclamo.empresaIds ?? [],
    empresaNombres,
    empresaSearch: normalizeSearchText(empresaNombres.join(' ')),
    causaIds: (reclamo.causas ?? []).map((c) => c.id),
    causaTextos,
    resumen: String(reclamo.resumen ?? '').trim(),
    hechoPreview,
    textoSearch,
    estadoDescripcion,
    idCasoEstado: reclamo.idCasoEstado,
    idGrupoEstado: reclamo.idGrupoEstado,
    provinciaNombre: reclamo.denunciante?.provinciaNombre,
    ciudadNombre: reclamo.denunciante?.ciudadNombre,
    createdAt: reclamo.createdAt,
    updatedAt: reclamo.updatedAt,
    anonPreview,
    indexedAt: new Date().toISOString(),
  };
}

async function main() {
  initFirebase();
  const db = admin.firestore();

  console.log('Cargando reclamos desde Firestore…');
  const snap = await db.collection('reclamos').get();
  const reclamos = snap.docs
    .map((doc) => doc.data())
    .filter((item) => !item.deletedAt);

  console.log(`Reclamos a indexar: ${reclamos.length}`);

  if (dryRun) {
    console.log('Dry run — no se escribió nada.');
    return;
  }

  let processed = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const reclamo of reclamos) {
    const indexDoc = buildSearchIndexDoc(reclamo);
    batch.set(db.collection('reclamos_busqueda').doc(String(reclamo.id)), indexDoc);
    batchCount += 1;
    processed += 1;

    if (batchCount >= batchSize) {
      await batch.commit();
      console.log(`Indexados ${processed}/${reclamos.length}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount) {
    await batch.commit();
    console.log(`Indexados ${processed}/${reclamos.length}`);
  }

  const indexedAt = new Date().toISOString();
  await db.collection('migration_meta').doc('reclamos_search_index').set(
    {
      indexedAt,
      count: processed,
      source: 'reclamos',
    },
    { merge: true }
  );

  console.log(`Índice listo: ${processed} documentos (${indexedAt})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
