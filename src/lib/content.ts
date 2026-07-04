import { getAdminDb } from '@/lib/firebase-admin';
import type {
  AuthorDocument,
  CategoryDocument,
  ContentDocument,
  TagDocument,
} from '@/types/content';

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) {
    throw new Error(
      'Firebase Admin no configurado. Completá .env.local con las credenciales.'
    );
  }
  return db;
}

function mapDoc<T>(data: FirebaseFirestore.DocumentData): T {
  return data as T;
}

function publishedPosts(docs: FirebaseFirestore.QueryDocumentSnapshot[]): ContentDocument[] {
  return docs
    .map((doc) => mapDoc<ContentDocument>(doc.data()))
    .filter((post) => post.status === 'publish')
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}

export async function getRecentPosts(limit = 12): Promise<ContentDocument[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection('posts')
    .orderBy('publishedAt', 'desc')
    .limit(Math.max(limit * 2, 24))
    .get();

  return publishedPosts(snap.docs).slice(0, limit);
}

export async function getAllPosts(limit = 100): Promise<ContentDocument[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection('posts')
    .orderBy('publishedAt', 'desc')
    .limit(Math.min(limit * 2, 500))
    .get();

  return publishedPosts(snap.docs).slice(0, limit);
}

export async function getPostBySlug(slug: string): Promise<ContentDocument | null> {
  const db = dbOrThrow();
  const doc = await db.collection('posts').doc(slug).get();
  if (!doc.exists) return null;
  const post = mapDoc<ContentDocument>(doc.data()!);
  return post.status === 'publish' ? post : null;
}

export async function getPageBySlug(slug: string): Promise<ContentDocument | null> {
  const db = dbOrThrow();
  const doc = await db.collection('pages').doc(slug).get();
  if (!doc.exists) return null;
  return mapDoc<ContentDocument>(doc.data()!);
}

export async function getPostsByCategory(
  categorySlug: string,
  limit = 50
): Promise<ContentDocument[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection('posts')
    .where('categorySlugs', 'array-contains', categorySlug)
    .limit(Math.min(limit * 2, 200))
    .get();

  return publishedPosts(snap.docs).slice(0, limit);
}

export async function getCategories(): Promise<CategoryDocument[]> {
  const db = dbOrThrow();
  const snap = await db.collection('categories').get();
  return snap.docs
    .map((doc) => mapDoc<CategoryDocument>(doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getCategory(slug: string): Promise<CategoryDocument | null> {
  const db = dbOrThrow();
  const doc = await db.collection('categories').doc(slug).get();
  if (!doc.exists) return null;
  return mapDoc<CategoryDocument>(doc.data()!);
}

export async function getTags(): Promise<TagDocument[]> {
  const db = dbOrThrow();
  const snap = await db.collection('tags').get();
  return snap.docs
    .map((doc) => mapDoc<TagDocument>(doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getAuthors(): Promise<AuthorDocument[]> {
  const db = dbOrThrow();
  const snap = await db.collection('authors').get();
  return snap.docs
    .map((doc) => mapDoc<AuthorDocument>(doc.data()!))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function hasMigratedContent(): Promise<boolean> {
  try {
    const db = getAdminDb();
    if (!db) return false;
    const meta = await db.collection('migration_meta').doc('wordpress').get();
    return meta.exists;
  } catch {
    return false;
  }
}
