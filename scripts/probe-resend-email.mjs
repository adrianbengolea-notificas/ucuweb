#!/usr/bin/env node
/**
 * Diagnóstico del flujo de emails (Resend) para reclamos.
 *
 * Uso:
 *   node scripts/probe-resend-email.mjs
 *   node scripts/probe-resend-email.mjs --send --to=tu@email.com
 *   node scripts/probe-resend-email.mjs --reclamo=6384
 *   node scripts/probe-resend-email.mjs --send --to=tu@email.com --reclamo=6384
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
  const args = { send: false, to: null, reclamoId: null };
  for (const arg of argv) {
    if (arg === '--send') args.send = true;
    else if (arg.startsWith('--to=')) args.to = arg.slice(5).trim();
    else if (arg.startsWith('--reclamo=')) args.reclamoId = Number(arg.slice(10));
  }
  return args;
}

function maskSecret(value) {
  if (!value) return '(vacío)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function parseFromEmail(raw) {
  const value = raw?.trim() || 'UCU Usuarios Protegidos <reclamos@ucu.org.ar>';
  const match = value.match(/<([^>]+)>/);
  const email = (match ? match[1] : value).trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : null;
  return { display: value, email, domain };
}

async function resendFetch(apiKey, pathname) {
  const response = await fetch(`https://api.resend.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function loadReclamoEmail(reclamoId) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || (!credPath && !privateKey)) {
    throw new Error('Faltan credenciales Firebase en .env.local para consultar el reclamo.');
  }

  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    if (credPath && fs.existsSync(credPath)) {
      initializeApp({ credential: cert(credPath), projectId });
    } else {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    }
  }

  const snap = await getFirestore().collection('reclamos').doc(String(reclamoId)).get();
  if (!snap.exists) throw new Error(`Reclamo #${reclamoId} no encontrado en Firestore.`);

  const data = snap.data();
  const denunciante = data.denunciante ?? {};
  const nombre = `${denunciante.nombre ?? ''} ${denunciante.apellido ?? ''}`.trim();
  const email = String(denunciante.email ?? '').trim();

  return {
    id: reclamoId,
    nombre,
    email,
    estado: data.estadoDescripcion ?? data.idCasoEstado,
    comunicaciones: (data.comunicaciones ?? []).length,
  };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function warn(msg) {
  console.log(`⚠ ${msg}`);
}

function fail(msg) {
  console.log(`✗ ${msg}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = parseFromEmail(process.env.RESEND_FROM_EMAIL);

  printSection('Configuración');
  console.log(`RESEND_API_KEY: ${maskSecret(apiKey)}`);
  console.log(`RESEND_FROM_EMAIL: ${from.display}`);
  console.log(`Dominio remitente: ${from.domain ?? '(no detectado)'}`);
  console.log(`GEMINI_API_KEY: ${maskSecret(process.env.GEMINI_API_KEY?.trim())}`);

  if (!apiKey || apiKey.startsWith('re_REEMPLAZAR')) {
    fail('RESEND_API_KEY no configurada.');
    process.exitCode = 1;
    return;
  }

  printSection('Dominios en Resend');
  const domainsRes = await resendFetch(apiKey, '/domains');
  let verifiedDomains = [];

  if (!domainsRes.ok) {
    if (domainsRes.status === 401 && String(domainsRes.data?.name) === 'restricted_api_key') {
      warn('La API key solo permite enviar (no listar dominios). Se omite verificación de dominio.');
    } else {
      fail(`No se pudieron listar dominios (${domainsRes.status}): ${JSON.stringify(domainsRes.data)}`);
      process.exitCode = 1;
      return;
    }
  } else {
    const domains = domainsRes.data?.data ?? [];
    if (!domains.length) {
      warn('No hay dominios verificados en esta cuenta de Resend.');
    } else {
      for (const domain of domains) {
        const status = domain.status ?? 'unknown';
        const line = `${domain.name} — ${status}`;
        if (status === 'verified') ok(line);
        else warn(line);
      }
    }

    verifiedDomains = domains
      .filter((d) => d.status === 'verified')
      .map((d) => String(d.name).toLowerCase());

    if (from.domain && verifiedDomains.includes(from.domain)) {
      ok(`El remitente usa un dominio verificado (${from.domain}).`);
    } else if (from.domain) {
      fail(`El remitente ${from.email} NO coincide con dominios verificados: ${verifiedDomains.join(', ') || '(ninguno)'}`);
      process.exitCode = 1;
    }
  }

  if (args.reclamoId) {
    printSection(`Reclamo #${args.reclamoId}`);
    try {
      const reclamo = await loadReclamoEmail(args.reclamoId);
      console.log(`Denunciante: ${reclamo.nombre || '(sin nombre)'}`);
      console.log(`Email destino admin: ${reclamo.email || '(vacío)'}`);
      console.log(`Estado: ${reclamo.estado ?? '—'}`);
      console.log(`Comunicaciones guardadas: ${reclamo.comunicaciones}`);
      if (!reclamo.email) {
        fail('Este reclamo no tiene email de denunciante. El admin no puede enviar correo.');
        process.exitCode = 1;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reclamo.email) || /\.(com|net|org)[a-z]{1,4}$/i.test(reclamo.email.split('@')[1] ?? '')) {
        fail(`Email del denunciante inválido o con typo: "${reclamo.email}"`);
        process.exitCode = 1;
      } else {
        warn('El botón "Enviar email" del admin manda al denunciante, NO al operador logueado.');
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }

  const sendTo = args.to || (args.send ? process.env.ADMIN_PANEL_EMAIL?.trim() : null);

  if (args.send) {
    if (!sendTo) {
      fail('Indicá destino con --to=tu@email.com o definí ADMIN_PANEL_EMAIL en .env.local');
      process.exitCode = 1;
      return;
    }

    printSection(`Envío de prueba → ${sendTo}`);
    const resend = new Resend(apiKey);
    const subject = `[UCU probe] Test Resend ${new Date().toISOString()}`;
    const body = `Email de prueba del script probe-resend-email.mjs\n\nSi llegó, Resend está OK.`;

    const { data, error } = await resend.emails.send({
      from: from.display,
      to: sendTo,
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
    });

    if (error) {
      fail(`Resend rechazó el envío: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    ok(`Email aceptado por Resend. messageId: ${data?.id ?? '(sin id)'}`);
    warn('Si no llega en 1-2 min, revisá spam y el dashboard de Resend → Logs.');
  } else {
    printSection('Siguiente paso');
    console.log('Para probar envío real:');
    console.log('  npm run probe:resend -- --send --to=tu@email.com');
    if (!args.reclamoId) {
      console.log('Para ver destino de un reclamo:');
      console.log('  npm run probe:resend -- --reclamo=6384');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
