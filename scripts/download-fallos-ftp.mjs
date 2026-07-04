#!/usr/bin/env node
/**
 * Descarga PDFs de fallos desde el FTP de Ferozo (DonWeb).
 * Reanuda descargas parciales (salta archivos ya existentes).
 *
 * Uso:
 *   FTP_HOST=c2230153.ferozo.com FTP_USER=... FTP_PASSWORD=... npm run download:fallos-ftp
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'basic-ftp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith('--output='));
const outputDir = outputArg
  ? path.resolve(rootDir, outputArg.split('=')[1])
  : path.join(rootDir, 'imports', 'fallos-pdf');

const host = process.env.FTP_HOST || 'c2230153.ferozo.com';
const user = process.env.FTP_USER;
const password = process.env.FTP_PASSWORD;
const remoteDir = '/public_html/images-observatorio/observatorio/fallos';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectClient() {
  const client = new Client(120_000);
  await client.access({
    host,
    user,
    password,
    secure: true,
    secureOptions: { rejectUnauthorized: false },
  });
  return client;
}

async function withRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`  Reintento ${attempt}/${retries - 1}: ${error.message}`);
      await sleep(2000 * attempt);
    }
  }
}

async function main() {
  if (!user || !password) {
    console.error('Faltan FTP_USER y FTP_PASSWORD (env o .env.local)');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Conectando a ${host}…`);
  let client = await connectClient();

  const expedientes = await client.list(remoteDir);
  const folders = expedientes
    .filter((item) => item.isDirectory && item.name !== '.' && item.name !== '..')
    .map((item) => item.name)
    .sort((a, b) => Number(a) - Number(b));

  console.log(`Expedientes en FTP: ${folders.length}`);

  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  for (let index = 0; index < folders.length; index += 1) {
    const expediente = folders[index];
    const localExpDir = path.join(outputDir, expediente);
    fs.mkdirSync(localExpDir, { recursive: true });

    let files;
    try {
      files = await withRetry(async () => {
        try {
          return await client.list(`${remoteDir}/${expediente}`);
        } catch {
          client.close();
          client = await connectClient();
          return client.list(`${remoteDir}/${expediente}`);
        }
      });
    } catch (error) {
      console.error(`  ✗ ${expediente}: no se pudo listar (${error.message})`);
      errors += 1;
      continue;
    }

    const pdfs = files.filter(
      (item) => !item.isDirectory && item.name.toLowerCase().endsWith('.pdf')
    );

    for (const pdf of pdfs) {
      const localPath = path.join(localExpDir, pdf.name);
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
        skipped += 1;
        continue;
      }

      try {
        await withRetry(async () => {
          try {
            await client.downloadTo(localPath, `${remoteDir}/${expediente}/${pdf.name}`);
          } catch {
            client.close();
            client = await connectClient();
            await client.downloadTo(localPath, `${remoteDir}/${expediente}/${pdf.name}`);
          }
        });
        downloaded += 1;
      } catch (error) {
        console.error(`  ✗ ${expediente}/${pdf.name}: ${error.message}`);
        errors += 1;
      }
    }

    if ((index + 1) % 25 === 0 || index + 1 === folders.length) {
      console.log(
        `Progreso ${index + 1}/${folders.length} — descargados: ${downloaded}, omitidos: ${skipped}, errores: ${errors}`
      );
    }
  }

  client.close();

  const localExpedientes = fs
    .readdirSync(outputDir)
    .filter((name) => fs.statSync(path.join(outputDir, name)).isDirectory()).length;
  let pdfCount = 0;
  for (const exp of fs.readdirSync(outputDir)) {
    const dir = path.join(outputDir, exp);
    if (!fs.statSync(dir).isDirectory()) continue;
    pdfCount += fs.readdirSync(dir).filter((f) => f.endsWith('.pdf')).length;
  }

  console.log(`
Listo en ${outputDir}
  Expedientes locales: ${localExpedientes}
  PDFs locales:          ${pdfCount}
  Descargados ahora:     ${downloaded}
  Ya existían:           ${skipped}
  Errores:               ${errors}
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
