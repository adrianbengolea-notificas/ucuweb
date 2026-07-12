#!/usr/bin/env node
/**
 * Corrige email del denunciante y reenvía comunicación de prueba.
 * Uso: node scripts/fix-reclamo-email-and-resend.mjs --reclamo=6384 --email=abengolea1@gmail.com
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env.local') });

function parseArgs(argv) {
  const args = { reclamoId: null, email: null };
  for (const arg of argv) {
    if (arg.startsWith('--reclamo=')) args.reclamoId = Number(arg.slice(10));
    if (arg.startsWith('--email=')) args.email = arg.slice(8).trim().toLowerCase();
  }
  return args;
}

async function initFirestore() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    if (credPath && fs.existsSync(credPath)) {
      initializeApp({ credential: cert(credPath), projectId });
    } else {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
    }
  }
  return getFirestore();
}

function bodyToHtml(text) {
  const lines = text
    .split('\n')
    .map((line) => `<p style="margin:0 0 8px 0;line-height:1.6">${line || '&nbsp;'}</p>`)
    .join('');
  return `<!DOCTYPE html><html lang="es"><body style="font-family:system-ui,sans-serif">${lines}</body></html>`;
}

async function main() {
  const { reclamoId, email } = parseArgs(process.argv.slice(2));
  if (!reclamoId || !email) {
    throw new Error('Uso: node scripts/fix-reclamo-email-and-resend.mjs --reclamo=6384 --email=abengolea1@gmail.com');
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'UCU Usuarios Protegidos <reclamos@ucu.org.ar>';
  if (!apiKey) throw new Error('Falta RESEND_API_KEY en .env.local');

  const db = await initFirestore();
  const ref = db.collection('reclamos').doc(String(reclamoId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Reclamo #${reclamoId} no encontrado`);

  const data = snap.data();
  const prevEmail = String(data.denunciante?.email ?? '').trim();
  const nombre = `${data.denunciante?.nombre ?? ''} ${data.denunciante?.apellido ?? ''}`.trim();

  console.log(`Reclamo #${reclamoId} — ${nombre}`);
  console.log(`Email anterior: ${prevEmail}`);
  console.log(`Email nuevo:    ${email}`);

  await ref.set(
    {
      denunciante: { ...data.denunciante, email },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log('✓ Email corregido en Firestore');

  const subject = `UCU — Actualización de su reclamo #${reclamoId}`;
  const body = `Estimado/a ${nombre || 'consumidor/a'}:

Le escribimos desde UCU — Usuarios y Consumidores Unidos en relación a su reclamo Nº ${reclamoId}.

Queremos confirmarle que su caso se encuentra registrado y en análisis por nuestro equipo. En breve nos pondremos en contacto para informarle los próximos pasos o solicitarle documentación adicional si fuera necesario.

Ante cualquier consulta, puede responder a este correo.

Saludos cordiales,
Equipo de Reclamos — UCU`;

  const resend = new Resend(apiKey);
  const { data: sent, error } = await resend.emails.send({
    from,
    to: email,
    subject,
    text: body,
    html: bodyToHtml(body),
  });

  if (error) throw new Error(error.message);

  const comunicacion = {
    id: `fix-${Date.now()}`,
    to: email,
    subject,
    body,
    sentAt: new Date().toISOString(),
    sentByEmail: process.env.ADMIN_PANEL_EMAIL || 'script@ucu.org.ar',
    sentByName: 'Script corrección email',
    viaIA: false,
  };

  const comunicaciones = [comunicacion, ...(data.comunicaciones ?? [])];
  await ref.set({ comunicaciones, updatedAt: new Date().toISOString() }, { merge: true });

  console.log(`✓ Email enviado a ${email}`);
  console.log(`  messageId: ${sent?.id ?? '(sin id)'}`);
}

main().catch((err) => {
  console.error('✗', err.message || err);
  process.exit(1);
});
