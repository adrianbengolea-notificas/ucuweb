#!/usr/bin/env node
/** Reenvía email de actualización con Reply-To correcto. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const reclamoId = Number(process.argv.find((a) => a.startsWith('--reclamo='))?.slice(10) || 6384);
const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM_EMAIL?.trim() || 'UCU Usuarios Protegidos <reclamos@ucu.org.ar>';
const inboundDomain = process.env.RESEND_INBOUND_DOMAIN?.trim();
const replyTo = inboundDomain
  ? `reclamos+${reclamoId}@${inboundDomain}`
  : process.env.RESEND_REPLY_TO?.trim() || process.env.ADMIN_PANEL_EMAIL?.trim();

if (!apiKey || !replyTo) throw new Error('Falta RESEND_API_KEY o RESEND_REPLY_TO/INBOUND_DOMAIN');

async function initFirestore() {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!getApps().length) {
    if (credPath && fs.existsSync(credPath)) {
      initializeApp({ credential: cert(credPath), projectId });
    } else {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    }
  }
  return getFirestore();
}

const db = await initFirestore();
const snap = await db.collection('reclamos').doc(String(reclamoId)).get();
if (!snap.exists) throw new Error('Reclamo no encontrado');
const data = snap.data();
const to = String(data.denunciante?.email ?? '').trim();
const nombre = `${data.denunciante?.nombre ?? ''} ${data.denunciante?.apellido ?? ''}`.trim();

const subject = `UCU — Actualización de su reclamo #${reclamoId}`;
const body = `Estimado/a ${nombre || 'consumidor/a'}:

Le escribimos desde UCU en relación a su reclamo Nº ${reclamoId}.

Puede responder a este correo para continuar la gestión de su caso.

Saludos cordiales,
Equipo de Reclamos — UCU`;

const resend = new Resend(apiKey);
const { data: sent, error } = await resend.emails.send({
  from,
  to,
  replyTo,
  subject,
  text: body,
  html: body.replace(/\n/g, '<br>'),
});

if (error) throw new Error(error.message);
console.log(`✓ Enviado a ${to}`);
console.log(`  Reply-To: ${replyTo}`);
console.log(`  messageId: ${sent?.id}`);
