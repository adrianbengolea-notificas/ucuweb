#!/usr/bin/env node
/** Dispara un webhook email.received firmado contra producción (prueba E2E). */
import { Webhook } from 'standardwebhooks';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'https://ucu.org.ar/api/webhooks/resend/inbound';
const reclamoId = Number(process.argv.find((a) => a.startsWith('--reclamo='))?.slice(10) || 6384);
const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
const inboundDomain = process.env.RESEND_INBOUND_DOMAIN?.trim() || 'xaezenu.resend.app';

if (!secret) throw new Error('Falta RESEND_WEBHOOK_SECRET en el entorno');

const payload = JSON.stringify({
  type: 'email.received',
  created_at: new Date().toISOString(),
  data: {
    email_id: `test-${Date.now()}`,
    created_at: new Date().toISOString(),
    from: 'Consumidor Prueba <abengolea1@gmail.com>',
    to: [`reclamos+${reclamoId}@${inboundDomain}`],
    subject: `Re: UCU — Prueba flujo reclamo #${reclamoId}`,
  },
});

const wh = new Webhook(secret);
const msgId = `msg_${Date.now()}`;
const timestamp = new Date();
const signature = wh.sign(msgId, timestamp, payload);

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'webhook-id': msgId,
    'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'webhook-signature': signature,
  },
  body: payload,
});

const text = await response.text();
console.log(`HTTP ${response.status}`);
console.log(text);

if (!response.ok) process.exit(1);
