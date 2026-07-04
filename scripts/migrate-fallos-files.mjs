#!/usr/bin/env node
/**
 * Sube los PDFs de fallos a Firebase Storage y normaliza las URLs en Firestore.
 *
 * Los archivos deben estar disponibles en una carpeta local (copiada desde el VPS):
 *   {localDir}/{nroExpediente}/{filename}.pdf
 *
 * Ejemplo (desde el VPS):
 *   scp -r user@vps:/ruta/observatorio/fallos ./imports/fallos-pdf
 *   npm run migrate:fallos-files -- --local-dir=imports/fallos-pdf
 */
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
const fixUrlsOnly = args.includes('--fix-urls-only');
const localDirArg = args.find((arg) => arg.startsWith('--local-dir='));
const localDir = localDirArg
  ? path.resolve(rootDir, localDirArg.split('=')[1])
  : process.env.OBSERVATORIO_FILES_LOCAL_DIR
    ? path.resolve(process.env.OBSERVATORIO_FILES_LOCAL_DIR)
    : null;

const legacyBase = (
  process.env.OBSERVATORIO_FILES_LEGACY_BASE || ''
).replace(/\/$/, '');

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'ucuweb-2887d.firebasestorage.app';

  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
      storageBucket: bucketName,
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
    storageBucket: bucketName,
  });
}

function resolveFalloFileUrl(url, expediente, filename) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('/observatorio/fallos/')) return trimmed;

  const match = trimmed.match(/\/observatorio\/fallos\/(\d+)\/([^/?#]+)/);
  if (match) return `/observatorio/fallos/${match[1]}/${match[2]}`;

  if (expediente && filename) {
    return `/observatorio/fallos/${expediente}/${filename}`;
  }

  return trimmed;
}

function storagePath(expediente, filename) {
  return `observatorio/fallos/${expediente}/${filename}`;
}

function findLocalFile(expediente, filename) {
  if (!localDir) return null;

  const candidates = [
    path.join(localDir, String(expediente), filename),
    path.join(localDir, filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

async function downloadLegacy(expediente, filename) {
  if (!legacyBase) return null;

  const url = `${legacyBase}/observatorio/fallos/${expediente}/${filename}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 100) return null;
  return buffer;
}

async function main() {
  console.log(`Migración de PDFs de fallos → Firebase Storage${dryRun ? ' (dry run)' : ''}`);

  if (!localDir && !legacyBase && !fixUrlsOnly) {
    console.error(`
No se indicó origen de archivos. Opciones:

  1. Carpeta local (recomendado):
     scp -r user@vps:/ruta/observatorio/fallos ./imports/fallos-pdf
     npm run migrate:fallos-files -- --local-dir=imports/fallos-pdf

  2. URL legacy (si el servidor anterior sigue sirviendo archivos):
     OBSERVATORIO_FILES_LEGACY_BASE=https://servidor-viejo npm run migrate:fallos-files
`);
    process.exit(1);
  }

  if (localDir) {
    if (!fs.existsSync(localDir)) {
      throw new Error(`No existe la carpeta local: ${localDir}`);
    }
    console.log(`Origen local: ${localDir}`);
  }
  if (legacyBase) console.log(`Origen legacy: ${legacyBase}`);

  initFirebase();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const snap = await db.collection('fallos').get();
  let totalFiles = 0;
  let uploaded = 0;
  let skipped = 0;
  let missing = 0;
  let updatedDocs = 0;

  for (const doc of snap.docs) {
    const fallo = doc.data();
    if (!fallo.files?.length) continue;

    let docChanged = false;
    const nextFiles = [];

    for (const file of fallo.files) {
      totalFiles += 1;
      const expediente = fallo.nroExpediente;
      const filename = String(file.file || '').trim();
      if (!filename) continue;

      const dest = storagePath(expediente, filename);
      const normalizedUrl = resolveFalloFileUrl(file.url, expediente, filename);

      if (normalizedUrl !== file.url) {
        docChanged = true;
      }

      nextFiles.push({ ...file, url: normalizedUrl });

      const [exists] = await bucket.file(dest).exists();
      if (exists) {
        skipped += 1;
        continue;
      }

      if (fixUrlsOnly) {
        missing += 1;
        continue;
      }

      const localPath = findLocalFile(expediente, filename);
      let buffer = localPath ? fs.readFileSync(localPath) : null;

      if (!buffer) {
        buffer = await downloadLegacy(expediente, filename);
      }

      if (!buffer) {
        missing += 1;
        console.warn(`  ✗ No encontrado: ${expediente}/${filename}`);
        continue;
      }

      if (!dryRun) {
        await bucket.file(dest).save(buffer, {
          metadata: {
            contentType: 'application/pdf',
            cacheControl: 'public, max-age=31536000, immutable',
          },
        });
      }

      uploaded += 1;
      console.log(`  ✓ ${expediente}/${filename} (${buffer.length} bytes)`);
    }

    if (docChanged && !dryRun) {
      await doc.ref.set({ files: nextFiles }, { merge: true });
      updatedDocs += 1;
    }
  }

  console.log(`
Resumen:
  Archivos referenciados: ${totalFiles}
  Subidos:               ${uploaded}
  Ya en Storage:         ${skipped}
  No encontrados:        ${missing}
  Docs con URL corregida: ${updatedDocs}
`);

  if (missing > 0) {
    console.log(
      'Faltan PDFs en el origen. Copiá la carpeta observatorio/fallos del VPS y volvé a ejecutar.'
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
