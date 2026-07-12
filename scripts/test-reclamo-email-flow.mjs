#!/usr/bin/env node
/**
 * Prueba end-to-end del flujo de emails de reclamos:
 * 1) Envío saliente (admin → consumidor)
 * 2) Respuesta entrante simulada (consumidor → inbound Resend)
 * 3) Verificación en Firestore de comunicaciones outbound + inbound
 *
 * Uso:
 *   node scripts/test-reclamo-email-flow.mjs --reclamo=6384
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env.local') });

const reclamoId = Number(
  process.argv.find((arg) => arg.startsWith('--reclamo='))?.slice(10) || 6384
);
const waitMs = Number(
  process.argv.find((arg) => arg.startsWith('--wait='))?.slice(7) || 12000
);

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM_EMAIL?.trim() || 'UCU Usuarios Protegidos <reclamos@ucu.org.ar>';
const inboundDomain = process.env.RESEND_INBOUND_DOMAIN?.trim() || 'xaezenu.resend.app';
const inboundLocal = process.env.RESEND_INBOUND_LOCAL_PART?.trim() || 'reclamos';
const replyTo = `${inboundLocal}+${reclamoId}@${inboundDomain}`;

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

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

async function getReclamo(db) {
  const snap = await db.collection('reclamos').doc(String(reclamoId)).get();
  if (!snap.exists) throw new Error(`Reclamo #${reclamoId} no encontrado`);
  return snap.data();
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!apiKey) throw new Error('Falta RESEND_API_KEY en .env.local');

  log('1/4', 'Configuración');
  ok(`Reclamo: #${reclamoId}`);
  ok(`From: ${from}`);
  ok(`Reply-To / inbound: ${replyTo}`);
  ok(`Webhook esperado: https://ucu.org.ar/api/webhooks/resend/inbound`);

  const db = await initFirestore();
  const reclamo = await getReclamo(db);
  const to = String(reclamo.denunciante?.email ?? '').trim();
  const nombre = `${reclamo.denunciante?.nombre ?? ''} ${reclamo.denunciante?.apellido ?? ''}`.trim();
  const beforeCount = (reclamo.comunicaciones ?? []).length;

  if (!to) throw new Error('El reclamo no tiene email de denunciante');

  log('2/4', `Envío saliente → ${to}`);
  const resend = new Resend(apiKey);
  const outboundSubject = `UCU — Prueba flujo reclamo #${reclamoId}`;
  const outboundBody = `Estimado/a ${nombre || 'consumidor/a'}:

Este es un envío de prueba automático del flujo de reclamos UCU.

Por favor ignore este mensaje si no esperaba una prueba.

Saludos,
Equipo UCU`;

  const outbound = await resend.emails.send({
    from,
    to,
    replyTo,
    subject: outboundSubject,
    text: outboundBody,
    html: outboundBody.replace(/\n/g, '<br>'),
  });

  if (outbound.error) throw new Error(`Outbound falló: ${outbound.error.message}`);
  ok(`Outbound messageId: ${outbound.data?.id}`);

  log('3/4', `Simulando respuesta del consumidor → ${replyTo}`);
  const inboundSubject = `Re: ${outboundSubject}`;
  const inboundBody =
    'Hola, recibí su mensaje. Esta es una respuesta de prueba del consumidor para validar el webhook inbound.';

  const inbound = await resend.emails.send({
    from,
    to: replyTo,
    subject: inboundSubject,
    text: inboundBody,
    html: `<p>${inboundBody}</p>`,
  });

  if (inbound.error) {
    fail(`No se pudo simular inbound vía API: ${inbound.error.message}`);
    fail('Probá responder manualmente al mail recibido en la bandeja del consumidor.');
  } else {
    ok(`Inbound simulado messageId: ${inbound.data?.id}`);
    ok(`Esperando ${waitMs / 1000}s al webhook de producción…`);
    await sleep(waitMs);
  }

  log('4/4', 'Verificando Firestore');
  const after = await getReclamo(db);
  const comunicaciones = after.comunicaciones ?? [];
  const delta = comunicaciones.length - beforeCount;

  ok(`Comunicaciones totales: ${comunicaciones.length} (antes: ${beforeCount}, nuevas: ${delta})`);

  const inboundSaved = comunicaciones.find(
    (c) =>
      c.direction === 'inbound' &&
      String(c.body ?? '').includes('respuesta de prueba del consumidor')
  );
  const outboundSaved = comunicaciones.filter((c) => c.direction === 'outbound').length;
  const inboundCount = comunicaciones.filter((c) => c.direction === 'inbound').length;

  console.log('');
  console.log('=== RESULTADO ===');
  console.log(`Outbound en Resend: ${outbound.data?.id ? 'OK' : 'FAIL'}`);
  console.log(`Inbound en Resend:  ${inbound.error ? 'NO SIMULADO' : 'OK'}`);
  console.log(`Inbound en admin:   ${inboundSaved ? 'OK' : 'PENDIENTE'}`);
  console.log(`Historial: ${outboundSaved} enviados, ${inboundCount} recibidos`);

  if (inboundSaved) {
    ok(`Respuesta guardada: "${inboundSaved.subject}"`);
    ok(`De: ${inboundSaved.from ?? inboundSaved.sentByEmail}`);
    process.exitCode = 0;
    return;
  }

  if (!inbound.error) {
    fail('El webhook no guardó la respuesta todavía.');
    console.log('  Revisá Resend → Receiving y Webhooks → logs del endpoint.');
    console.log('  Si el evento está en Receiving pero no en admin, revisá RESEND_WEBHOOK_SECRET.');
    process.exitCode = 1;
    return;
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error('✗', error.message || error);
  process.exit(1);
});
