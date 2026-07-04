import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPermissionsForRole, hasPermission } from '@/lib/admin-roles';
import type { AdminPermission, AdminRole, ReclamosWriteScope } from '@/types/admin-users';

export const ADMIN_SESSION_COOKIE = 'ucu_admin_sess';
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8;

export function getAllowedAdminEmails(): string[] {
  const emails = new Set<string>();
  const primary = process.env.ADMIN_PANEL_EMAIL?.trim().toLowerCase();
  if (primary) emails.add(primary);

  const extra = process.env.ADMIN_ALLOWED_EMAILS?.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  extra?.forEach((email) => emails.add(email));

  return [...emails];
}

export type AdminSessionConfig = {
  secret: string;
  allowedEmails: string[];
  password?: string;
};

export type AdminSession = {
  email: string;
  role: AdminRole;
  name: string;
  secret: string;
  permissions: AdminPermission[];
  reclamosWriteScope: ReclamosWriteScope;
};

export function getAdminSessionConfig(): AdminSessionConfig | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  const allowedEmails = getAllowedAdminEmails();
  const password = process.env.ADMIN_PANEL_PASSWORD?.trim();

  if (!secret || !allowedEmails.length) return null;

  return { secret, allowedEmails, password };
}

/** @deprecated Usar getAdminSessionConfig */
export type AdminPanelConfig = { email: string; password: string; secret: string };

/** @deprecated Usar getAdminSessionConfig */
export function getAdminPanelConfig(): AdminPanelConfig | null {
  const cfg = getAdminSessionConfig();
  if (!cfg?.password || !cfg.allowedEmails[0]) return null;
  return {
    email: cfg.allowedEmails[0],
    password: cfg.password,
    secret: cfg.secret,
  };
}

type SessionPayload = {
  e: string;
  r: AdminRole;
  n: string;
  s?: 'a' | 'f';
  exp: number;
};

function scopeToToken(scope: ReclamosWriteScope): 'a' | 'f' {
  return scope === 'assigned' ? 'a' : 'f';
}

function scopeFromToken(value: unknown): ReclamosWriteScope {
  return value === 'a' ? 'assigned' : 'all';
}

export function signAdminSession(
  email: string,
  secret: string,
  role: AdminRole,
  name: string,
  reclamosWriteScope: ReclamosWriteScope = 'all'
): string {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
  const payload = Buffer.from(
    JSON.stringify({
      e: email.trim().toLowerCase(),
      r: role,
      n: name.trim(),
      s: scopeToToken(reclamosWriteScope),
      exp,
    } satisfies SessionPayload),
    'utf8'
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(
  token: string,
  secret: string
): { email: string; role: AdminRole; name: string; reclamosWriteScope: ReclamosWriteScope } | null {
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
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<
      SessionPayload & { exp: number }
    >;
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    const email = data.e?.trim().toLowerCase();
    if (!email) return null;

    const role = (data.r as AdminRole) ?? 'administrador';
    const name = data.n?.trim() || email.split('@')[0] || email;
    const reclamosWriteScope = scopeFromToken(data.s);

    return { email, role, name, reclamosWriteScope };
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(
  response: NextResponse,
  email: string,
  secret: string,
  role: AdminRole,
  name: string,
  reclamosWriteScope: ReclamosWriteScope = 'all'
): void {
  const token = signAdminSession(email, secret, role, name, reclamosWriteScope);
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });
}

export function requireAdminSession(request: NextRequest): AdminSession | null {
  const cfg = getAdminSessionConfig();
  if (!cfg) return null;
  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = verifyAdminSessionToken(raw, cfg.secret);
  if (!session) return null;

  const permissions = getPermissionsForRole(session.role);

  return {
    email: session.email,
    role: session.role,
    name: session.name,
    secret: cfg.secret,
    permissions,
    reclamosWriteScope: session.reclamosWriteScope,
  };
}

export function requireAdminPermission(
  request: NextRequest,
  permission: AdminPermission | AdminPermission[]
): AdminSession | null {
  const session = requireAdminSession(request);
  if (!session) return null;
  if (!hasPermission(session.permissions, permission)) return null;
  return session;
}

export function isAllowedAdminEmail(email: string): boolean {
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}
