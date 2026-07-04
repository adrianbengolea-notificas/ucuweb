import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdminPermission } from '@/lib/admin-session';

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'posts:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }

  const snap = await db.collection('categories').get();
  const categories = snap.docs
    .map((doc) => doc.data())
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  return NextResponse.json({ categories });
}
