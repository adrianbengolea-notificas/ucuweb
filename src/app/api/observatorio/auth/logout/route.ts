import { NextResponse } from 'next/server';
import { clearColaboradorSessionCookie } from '@/lib/colaborador-session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearColaboradorSessionCookie(res);
  return res;
}
