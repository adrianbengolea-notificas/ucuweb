#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import {
  collectMojibakeStrings,
  fixEncodingDeep,
  hasMojibake,
} from './lib/fix-encoding.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const onlyCollections = onlyArg
  ? onlyArg
      .split('=')[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  : null;

const COLLECTIONS = [
  { name: 'fallos', idField: 'nroExpediente' },
  { name: 'observatorio_juzgados', idField: 'id' },
  { name: 'observatorio_provincias', idField: 'id' },
  { name: 'observatorio_ciudades', idField: 'id' },
  { name: 'observatorio_tipos_juicio', idField: 'id' },
  { name: 'observatorio_reclamos', idField: 'id' },
  { name: 'observatorio_etiquetas', idField: 'id' },
  { name: 'observatorio_empresas', idField: 'id' },
  { name: 'observatorio_rubros', idField: 'id' },
  { name: 'observatorio_divisas', idField: 'id' },
];

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

function docChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function fixCollection(db, { name, idField }) {
  console.log(`\nRevisando ${name}…`);
  const snap = await db.collection(name).get();
  const pending = [];

  for (const doc of snap.docs) {
    const before = doc.data();
    const after = fixEncodingDeep(before);
    if (!docChanged(before, after)) continue;

    const hits = collectMojibakeStrings(before);
    pending.push({ ref: doc.ref, before, after, hits, id: before[idField] ?? doc.id });

    if (verbose) {
      console.log(`  • doc ${doc.id}`);
      for (const hit of hits.slice(0, 5)) {
        console.log(`    ${hit.path}`);
        console.log(`      - ${hit.before}`);
        console.log(`      + ${hit.after}`);
      }
      if (hits.length > 5) console.log(`    … y ${hits.length - 5} más`);
    }
  }

  if (!pending.length) {
    console.log(`  Sin cambios en ${name}.`);
    return { scanned: snap.size, fixed: 0 };
  }

  console.log(`  ${pending.length}/${snap.size} documentos con mojibake.`);

  if (dryRun) {
    const sample = pending[0];
    const sampleHit = sample.hits[0];
    if (sampleHit) {
      console.log(`  Ejemplo (${sample.id}):`);
      console.log(`    - ${sampleHit.before}`);
      console.log(`    + ${sampleHit.after}`);
    }
    return { scanned: snap.size, fixed: pending.length };
  }

  const batchSize = 400;
  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = db.batch();
    for (const item of pending.slice(index, index + batchSize)) {
      batch.set(item.ref, item.after, { merge: false });
    }
    await batch.commit();
    console.log(
      `  Escritos ${Math.min(index + batchSize, pending.length)}/${pending.length} en ${name}.`
    );
  }

  return { scanned: snap.size, fixed: pending.length };
}

async function main() {
  console.log(`Corrección de encoding observatorio${dryRun ? ' (dry run)' : ''}`);

  initFirebase();
  const db = admin.firestore();

  const targets = onlyCollections
    ? COLLECTIONS.filter((item) => onlyCollections.includes(item.name))
    : COLLECTIONS;

  if (!targets.length) {
    throw new Error(
      `Colección no reconocida. Opciones: ${COLLECTIONS.map((item) => item.name).join(', ')}`
    );
  }

  const totals = { scanned: 0, fixed: 0 };
  for (const collection of targets) {
    const result = await fixCollection(db, collection);
    totals.scanned += result.scanned;
    totals.fixed += result.fixed;
  }

  console.log('\nResumen:');
  console.log(`  Documentos revisados: ${totals.scanned}`);
  console.log(`  Documentos ${dryRun ? 'a corregir' : 'corregidos'}: ${totals.fixed}`);

  if (totals.fixed > 0 && !dryRun) {
    console.log('\nSugerencia: reconstruí el índice de búsqueda con npm run build:fallos-index');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
