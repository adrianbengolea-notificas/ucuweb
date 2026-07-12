import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import type { DriveConnection } from '@/types/admin-users';

function dbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');
  return db;
}

const DRIVE_CONNECTIONS_COLLECTION = 'adminDriveConnections';

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000';
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET no configurados');
  }
  return { clientId, clientSecret, baseUrl };
}

export function buildDriveOAuthUrl(adminEmail: string): string {
  const { clientId, baseUrl } = getOAuthConfig();
  const redirectUri = `${baseUrl}/api/admin/drive/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    access_type: 'offline',
    prompt: 'consent',
    // state lleva el email del admin para atribuir el token al usuario correcto
    state: Buffer.from(JSON.stringify({ adminEmail })).toString('base64url'),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ accessToken: string; refreshToken: string; googleEmail: string }> {
  const { clientId, clientSecret, baseUrl } = getOAuthConfig();
  const redirectUri = `${baseUrl}/api/admin/drive/callback`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Error al intercambiar código OAuth');
  }
  if (!data.refresh_token) {
    throw new Error(
      'Google no devolvió refresh_token. Asegurate de que el usuario haya revocado el acceso previo o usar prompt=consent.'
    );
  }

  const googleEmail = await getGoogleEmailFromToken(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    googleEmail,
  };
}

async function getGoogleEmailFromToken(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const info = (await res.json()) as { email?: string };
  return info.email ?? 'unknown';
}

export async function getAccessTokenForAdmin(adminEmail: string): Promise<string> {
  const connection = await getDriveConnection(adminEmail);
  if (!connection) throw new Error(`El delegado ${adminEmail} no tiene Drive conectado`);

  const { clientId, clientSecret } = getOAuthConfig();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: connection.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || 'No se pudo renovar el access token de Drive');
  }
  return data.access_token;
}

export async function saveDriveConnection(
  adminEmail: string,
  connection: DriveConnection
): Promise<void> {
  const db = dbOrThrow();
  await db.collection(DRIVE_CONNECTIONS_COLLECTION).doc(adminEmail).set(connection);
}

export async function getDriveConnection(adminEmail: string): Promise<DriveConnection | null> {
  const db = dbOrThrow();
  const snap = await db.collection(DRIVE_CONNECTIONS_COLLECTION).doc(adminEmail).get();
  if (!snap.exists) return null;
  return snap.data() as DriveConnection;
}

export async function deleteDriveConnection(adminEmail: string): Promise<void> {
  const db = dbOrThrow();
  await db.collection(DRIVE_CONNECTIONS_COLLECTION).doc(adminEmail).delete();
}

export function parseOAuthState(state: string): { adminEmail: string } {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as {
      adminEmail: string;
    };
  } catch {
    throw new Error('Estado OAuth inválido');
  }
}
