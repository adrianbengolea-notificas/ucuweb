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

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    throw new Error('Faltan credenciales Firebase Admin.');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function commentId(wpId) {
  return `wp-${wpId}`;
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

function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
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
      ['item', 'wp:comment', 'wp:postmeta', 'category', 'wp:author', 'wp:category', 'wp:tag'].includes(
        tagName
      ),
  });

  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel) throw new Error('XML inválido');

  const items = asArray(channel.item);
  const comments = [];

  for (const item of items) {
    const postType = text(item['wp:post_type']);
    if (postType !== 'post') continue;

    const postSlug = text(item['wp:post_name']);
    const postTitle = text(item.title);
    const postComments = asArray(item['wp:comment']);

    for (const wpComment of postComments) {
      const wpCommentId = Number(text(wpComment['wp:comment_id']));
      const wpParentId = Number(text(wpComment['wp:comment_parent']) || 0);
      const approved = text(wpComment['wp:comment_approved']);
      const commentType = text(wpComment['wp:comment_type']) || 'comment';

      if (!wpCommentId || commentType !== 'comment') continue;

      comments.push({
        id: commentId(wpCommentId),
        postSlug,
        postTitle,
        parentId: wpParentId ? commentId(wpParentId) : null,
        authorName: text(wpComment['wp:comment_author']) || 'Anónimo',
        authorEmail: text(wpComment['wp:comment_author_email']) || undefined,
        content: stripHtml(text(wpComment['wp:comment_content'])),
        status: approved === '1' ? 'approved' : 'pending',
        isAdminReply: false,
        createdAt: new Date(text(wpComment['wp:comment_date_gmt']) || text(wpComment['wp:comment_date'])).toISOString(),
        wpCommentId,
      });
    }
  }

  console.log(`Comentarios encontrados: ${comments.length}`);

  if (dryRun) {
    console.log('Dry run completado.');
    return;
  }

  initFirebase();
  const db = admin.firestore();

  const operations = comments
    .filter((c) => c.content)
    .map((comment) => ({
      ref: db.collection('comments').doc(comment.id),
      data: comment,
    }));

  console.log('Escribiendo comentarios en Firestore...');
  await commitBatch(db, operations);

  await db.collection('migration_meta').doc('wordpress-comments').set({
    source: 'ucu.org.ar',
    xmlFile: path.basename(xmlPath),
    migratedAt: new Date().toISOString(),
    count: operations.length,
  });

  console.log(`Migración completada: ${operations.length} comentarios`);
}

main().catch((error) => {
  console.error('\nError en migración de comentarios:', error.message);
  process.exit(1);
});
