import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ColaboradorSession } from '@/types/colaboradores';

export const COLABORADOR_SESSION_COOKIE = 'ucu_colab_sess';
export const COLABORADOR_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

type SessionPayload = {
  u: string;
  e: string;
  n: string;
  p?: string;
  exp: number;
};

function getSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET?.trim() || null;
}

export function signColaboradorSession(session: ColaboradorSession): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + COLABORADOR_SESSION_MAX_AGE_SEC;
  const payload = Buffer.from(
    JSON.stringify({
      u: session.uid,
      e: session.email.trim().toLowerCase(),
      n: session.name.trim(),
      p: session.photoUrl?.trim() || undefined,
      exp,
    } satisfies SessionPayload),
    'utf8'
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyColaboradorSessionToken(token: string): ColaboradorSession | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    const uid = data.u?.trim();
    const email = data.e?.trim().toLowerCase();
    if (!uid || !email) return null;

    return {
      uid,
      email,
      name: data.n?.trim() || email.split('@')[0] || email,
      photoUrl: data.p?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export function setColaboradorSessionCookie(response: NextResponse, session: ColaboradorSession): boolean {
  const token = signColaboradorSession(session);
  if (!token) return false;

  response.cookies.set(COLABORADOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COLABORADOR_SESSION_MAX_AGE_SEC,
  });
  return true;
}

export function clearColaboradorSessionCookie(response: NextResponse): void {
  response.cookies.set(COLABORADOR_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function requireColaboradorSession(request: NextRequest): ColaboradorSession | null {
  const raw = request.cookies.get(COLABORADOR_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifyColaboradorSessionToken(raw);
}
