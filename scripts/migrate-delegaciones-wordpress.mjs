#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { XMLParser } from 'fast-xml-parser';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const xmlArgIndex = args.indexOf('--xml');
const xmlPath =
  xmlArgIndex >= 0
    ? path.resolve(args[xmlArgIndex + 1])
    : path.join(rootDir, 'imports', 'ucu.WordPress.2026-07-02.xml');

function text(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && value.__cdata != null) return String(value.__cdata);
  return String(value);
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmail(value) {
  const cleaned = stripHtml(value);
  const match = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : cleaned || null;
}

function looksLikeUrl(value) {
  const v = stripHtml(value).toLowerCase();
  return (
    /^https?:\/\//.test(v) ||
    /^www\./.test(v) ||
    (/\.(com|org|ar|net)(\/|$|\s)/.test(v) && !/\d{3,}/.test(v.split('.')[0]))
  );
}

function normalizeUrl(value) {
  const trimmed = stripHtml(value);
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (/^[a-z0-9.-]+\.(com|org|ar|net)(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function normalizeProvincia(ciudad, provincia) {
  const prov = stripHtml(provincia);
  if (prov) return prov;
  if (/^caba/i.test(stripHtml(ciudad))) return 'Ciudad Autónoma de Buenos Aires';
  return 'Sin provincia';
}

function parseDelegados(raw) {
  let textValue = stripHtml(raw)
    .replace(/^delegados?\s+ucu[^:]*:\s*/i, '')
    .replace(/^abog\.?\s*/i, '')
    .trim();

  if (!textValue) return [];

  const parts = textValue
    .split(/\s*,\s*|\s+\by\b\s+|\s+\be\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((nombre, index) => ({
    id: `wp-${slugify(nombre) || index}`,
    nombre,
    fotoUrl: null,
  }));
}

function extractTableRows(html) {
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
    const cells = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;

    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(tdMatch[1]);
    }

    if (cells.length >= 6) {
      rows.push({
        ciudad: stripHtml(cells[0]),
        provincia: stripHtml(cells[1]),
        delegados: cells[2],
        direccion: cells[3],
        telefono: cells[4],
        email: cells[5],
      });
    }
  }

  return rows;
}

function buildDelegacion(row, index) {
  const ciudad = row.ciudad.trim();
  const provincia = normalizeProvincia(ciudad, row.provincia);
  const direccionRaw = stripHtml(row.direccion);
  const webFromDireccion = looksLikeUrl(row.direccion) ? normalizeUrl(row.direccion) : null;
  const direccion = webFromDireccion ? null : direccionRaw || null;
  const webUrl = webFromDireccion;
  const telefono = stripHtml(row.telefono).replace(/\s+/g, ' ').trim() || null;
  const email = extractEmail(row.email);
  const delegados = parseDelegados(row.delegados);
  const slugBase = slugify(`ucu-${ciudad}`) || `delegacion-${index + 1}`;
  const now = new Date().toISOString();

  return {
    slug: slugBase,
    nombre: ciudad.match(/^ucu\b/i) ? ciudad : `UCU ${ciudad}`,
    provincia,
    delegados,
    webUrl,
    facebookUrl: null,
    instagramUrl: null,
    twitterUrl: null,
    email,
    telefono,
    direccion,
    orden: index,
    status: 'publish',
    createdAt: now,
    modifiedAt: now,
    source: 'wordpress-tablepress',
  };
}

function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
    });
    return admin.firestore();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales Firebase Admin en .env.local');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return admin.firestore();
}

function findDelegacionesPage(items) {
  return items.find(
    (item) =>
      text(item['wp:post_type']) === 'page' &&
      text(item['wp:post_name']) === 'delegaciones' &&
      text(item['wp:status']) === 'publish'
  );
}

async function main() {
  console.log(`Migrando delegaciones desde WordPress${dryRun ? ' (dry-run)' : ''}…`);
  console.log(`XML: ${xmlPath}`);

  if (!fs.existsSync(xmlPath)) {
    throw new Error(`No se encontró el XML en ${xmlPath}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
  });
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const data = parser.parse(xml);
  const items = asArray(data?.rss?.channel?.item);
  const page = findDelegacionesPage(items);

  if (!page) {
    throw new Error('No se encontró la página "delegaciones" en el export de WordPress.');
  }

  const html = text(page['content:encoded']);
  const rows = extractTableRows(html);

  if (rows.length === 0) {
    throw new Error('No se pudieron extraer filas de la tabla TablePress en /delegaciones/.');
  }

  const slugCounts = new Map();
  const delegaciones = rows.map((row, index) => {
    const doc = buildDelegacion(row, index);
    const count = slugCounts.get(doc.slug) ?? 0;
    slugCounts.set(doc.slug, count + 1);
    if (count > 0) {
      doc.slug = `${doc.slug}-${count + 1}`;
    }
    return doc;
  });

  const totalDelegados = delegaciones.reduce((sum, d) => sum + d.delegados.length, 0);

  console.log(`\nDelegaciones encontradas: ${delegaciones.length}`);
  console.log(`Delegados parseados: ${totalDelegados}`);
  console.log(`Última modificación WP: ${text(page['wp:post_modified'])}\n`);

  for (const delegacion of delegaciones) {
    console.log(`• ${delegacion.nombre} (${delegacion.provincia})`);
    console.log(
      `  slug=${delegacion.slug} | delegados=${delegacion.delegados.length} | tel=${delegacion.telefono ?? '—'} | email=${delegacion.email ?? '—'}`
    );
    if (delegacion.direccion) console.log(`  dirección: ${delegacion.direccion}`);
    if (delegacion.webUrl) console.log(`  web: ${delegacion.webUrl}`);
    console.log(`  nombres: ${delegacion.delegados.map((d) => d.nombre).join(' · ')}`);
  }

  if (dryRun) {
    console.log('\nDry-run: no se escribió nada en Firestore.');
    return;
  }

  const db = initFirebase();
  let batch = db.batch();
  let ops = 0;

  for (const delegacion of delegaciones) {
    batch.set(db.collection('delegaciones').doc(delegacion.slug), delegacion, { merge: true });
    ops += 1;
    if (ops % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (ops % 400 !== 0) {
    await batch.commit();
  }

  console.log(`\nImportación completada: ${delegaciones.length} delegaciones en Firestore.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
