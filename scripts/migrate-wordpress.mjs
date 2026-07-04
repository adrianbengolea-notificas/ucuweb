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
const skipImages = args.includes('--skip-images');
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

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
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
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

function getMetaMap(postmeta) {
  const map = {};
  for (const meta of asArray(postmeta)) {
    const key = text(meta['wp:meta_key']);
    if (!key) continue;
    map[key] = text(meta['wp:meta_value']);
  }
  return map;
}

function getTerms(item) {
  const categories = [];
  const tags = [];

  for (const term of asArray(item.category)) {
    const domain = term['@_domain'];
    const slug = term['@_nicename'];
    const name = text(term);
    if (!slug || !name) continue;
    if (domain === 'category') categories.push({ slug, name });
    if (domain === 'post_tag') tags.push({ slug, name });
  }

  return { categories, tags };
}

function storagePublicUrl(bucketName, storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function rewriteContentUrls(html, urlMap) {
  let output = html;
  for (const [original, migrated] of urlMap.entries()) {
    output = output.split(original).join(migrated);
  }
  return output;
}

async function uploadAttachment(bucket, bucketName, attachment, dryRunMode) {
  const sourceUrl = text(attachment['wp:attachment_url']) || text(attachment.guid);
  if (!sourceUrl) return null;

  const filePath = getMetaMap(attachment['wp:postmeta'])['_wp_attached_file'];
  const storagePath = filePath ? `media/${filePath}` : `media/${path.basename(sourceUrl)}`;

  if (dryRunMode) {
    return { originalUrl: sourceUrl, url: sourceUrl, storagePath, filename: path.basename(storagePath) };
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    console.warn(`No se pudo descargar: ${sourceUrl} (${response.status})`);
    return { originalUrl: sourceUrl, url: sourceUrl, storagePath, filename: path.basename(storagePath) };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType, cacheControl: 'public,max-age=31536000' },
  });

  try {
    await file.makePublic();
  } catch {
    // En buckets uniformes puede fallar; la URL pública sigue funcionando con reglas de lectura.
  }

  return {
    originalUrl: sourceUrl,
    url: storagePublicUrl(bucketName, storagePath),
    storagePath,
    filename: path.basename(storagePath),
    mimeType: contentType,
  };
}

function buildContentDoc(item, type, authorsByLogin, attachmentsById, urlMap) {
  const meta = getMetaMap(item['wp:postmeta']);
  const { categories, tags } = getTerms(item);
  const creator = text(item['dc:creator']);
  const authorInfo = authorsByLogin.get(creator) || {
    login: creator,
    name: creator,
    email: '',
  };

  const thumbnailId = meta._thumbnail_id ? Number(meta._thumbnail_id) : null;
  const thumbnail = thumbnailId ? attachmentsById.get(thumbnailId) : null;

  const rawContent = text(item['content:encoded']);
  const rawExcerpt = text(item['excerpt:encoded']);

  return {
    wpId: Number(text(item['wp:post_id'])),
    title: text(item.title),
    slug: text(item['wp:post_name']),
    content: rewriteContentUrls(rawContent, urlMap),
    excerpt: rewriteContentUrls(rawExcerpt, urlMap),
    status: text(item['wp:status']) || 'draft',
    publishedAt: new Date(text(item['wp:post_date_gmt']) || text(item.pubDate)).toISOString(),
    modifiedAt: new Date(text(item['wp:post_modified_gmt']) || text(item.pubDate)).toISOString(),
    author: {
      login: authorInfo.login,
      name: authorInfo.name,
      email: authorInfo.email || undefined,
    },
    categories,
    tags,
    categorySlugs: categories.map((c) => c.slug),
    tagSlugs: tags.map((t) => t.slug),
    featuredImage: thumbnail
      ? {
          url: thumbnail.url,
          alt: text(item.title),
        }
      : null,
    type,
    originalLink: text(item.link),
  };
}

function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function commitBatch(db, operations) {
  const chunkSize = 400;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const batch = db.batch();
    for (const op of operations.slice(i, i + chunkSize)) {
      batch.set(op.ref, stripUndefined(op.data), { merge: true });
    }
    await batch.commit();
  }
}

async function main() {
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`No se encontró el export XML en: ${xmlPath}`);
  }

  console.log(`Leyendo export: ${xmlPath}`);
  const xml = fs.readFileSync(xmlPath, 'utf8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    isArray: (tagName) =>
      [
        'item',
        'wp:author',
        'wp:category',
        'wp:tag',
        'category',
        'wp:postmeta',
      ].includes(tagName),
  });

  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error('XML inválido: no se encontró rss.channel');
  }

  const authorsByLogin = new Map();
  for (const author of asArray(channel['wp:author'])) {
    const login = text(author['wp:author_login']);
    authorsByLogin.set(login, {
      wpAuthorId: Number(text(author['wp:author_id'])),
      login,
      name: text(author['wp:author_display_name']) || login,
      email: text(author['wp:author_email']) || undefined,
    });
  }

  const categories = asArray(channel['wp:category']).map((cat) => ({
    wpTermId: Number(text(cat['wp:term_id'])),
    slug: text(cat['wp:category_nicename']),
    name: text(cat['wp:cat_name']),
    description: text(cat['wp:category_description']) || undefined,
  }));

  const tags = asArray(channel['wp:tag']).map((tag) => ({
    wpTermId: Number(text(tag['wp:term_id'])),
    slug: text(tag['wp:tag_slug']),
    name: text(tag['wp:tag_name']),
  }));

  const items = asArray(channel.item);
  const attachments = items.filter((item) => text(item['wp:post_type']) === 'attachment');
  const posts = items.filter(
    (item) => text(item['wp:post_type']) === 'post' && text(item['wp:status']) === 'publish'
  );
  const pages = items.filter(
    (item) => text(item['wp:post_type']) === 'page' && text(item['wp:status']) === 'publish'
  );

  console.log('Resumen del export:');
  console.log(`  Autores: ${authorsByLogin.size}`);
  console.log(`  Categorías: ${categories.length}`);
  console.log(`  Etiquetas: ${tags.length}`);
  console.log(`  Posts publicados: ${posts.length}`);
  console.log(`  Páginas publicadas: ${pages.length}`);
  console.log(`  Adjuntos: ${attachments.length}`);

  if (dryRun) {
    console.log('\nDry run completado. No se escribió nada en Firebase.');
    return;
  }

  initFirebase();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const bucketName = bucket.name;

  const attachmentsById = new Map();
  const urlMap = new Map();
  const mediaOps = [];

  console.log(skipImages ? '\nOmitiendo subida de imágenes...' : '\nMigrando adjuntos...');

  for (const [index, attachment] of attachments.entries()) {
    const wpId = Number(text(attachment['wp:post_id']));
    let uploaded;

    if (skipImages) {
      const sourceUrl = text(attachment['wp:attachment_url']) || text(attachment.guid);
      uploaded = {
        wpId,
        originalUrl: sourceUrl,
        url: sourceUrl,
        filename: path.basename(sourceUrl),
      };
    } else {
      uploaded = await uploadAttachment(bucket, bucketName, attachment, false);
      if (!uploaded) continue;
      uploaded.wpId = wpId;
      urlMap.set(uploaded.originalUrl, uploaded.url);
    }

    attachmentsById.set(wpId, uploaded);
    mediaOps.push({
      ref: db.collection('media').doc(String(wpId)),
      data: uploaded,
    });

    if ((index + 1) % 50 === 0) {
      console.log(`  ${index + 1}/${attachments.length} adjuntos procesados`);
    }
  }

  const operations = [];

  for (const author of authorsByLogin.values()) {
    operations.push({
      ref: db.collection('authors').doc(author.login),
      data: author,
    });
  }

  for (const category of categories) {
    if (!category.slug) continue;
    operations.push({
      ref: db.collection('categories').doc(category.slug),
      data: category,
    });
  }

  for (const tag of tags) {
    if (!tag.slug) continue;
    operations.push({
      ref: db.collection('tags').doc(tag.slug),
      data: tag,
    });
  }

  for (const post of posts) {
    const doc = buildContentDoc(post, 'post', authorsByLogin, attachmentsById, urlMap);
    if (!doc.slug) continue;
    operations.push({
      ref: db.collection('posts').doc(doc.slug),
      data: doc,
    });
  }

  for (const page of pages) {
    const doc = buildContentDoc(page, 'page', authorsByLogin, attachmentsById, urlMap);
    if (!doc.slug) continue;
    operations.push({
      ref: db.collection('pages').doc(doc.slug),
      data: doc,
    });
  }

  operations.push({
    ref: db.collection('migration_meta').doc('wordpress'),
    data: {
      source: 'ucu.org.ar',
      xmlFile: path.basename(xmlPath),
      migratedAt: new Date().toISOString(),
      counts: {
        authors: authorsByLogin.size,
        categories: categories.length,
        tags: tags.length,
        posts: posts.length,
        pages: pages.length,
        attachments: attachments.length,
      },
      skipImages,
    },
  });

  console.log('\nEscribiendo en Firestore...');
  await commitBatch(db, [...mediaOps, ...operations]);

  console.log('\nMigración completada.');
  console.log(`  Firestore: ${operations.length + mediaOps.length} documentos`);
  console.log(`  Storage: ${skipImages ? 'omitido' : `${attachments.length} archivos intentados`}`);
}

main().catch((error) => {
  console.error('\nError en migración:', error.message);
  process.exit(1);
});
