import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });

const to = process.argv[2] || 'abengolea1@gmail.com';
const key = process.env.RESEND_API_KEY?.trim();
const from =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  'UCU Usuarios Protegidos <reclamos@ucu.org.ar>';

if (!key || key.startsWith('re_REEMPLAZAR')) {
  console.error('RESEND_API_KEY no configurada en .env.local');
  process.exit(1);
}

const resend = new Resend(key);
const body = `Hola,

Este es un mail de prueba del sistema UCU (Usuarios Protegidos).

Si lo recibiste, Resend está funcionando correctamente.

Saludos,
Equipo UCU`;

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'UCU — Prueba de envío de email',
  text: body,
  html: `<p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
});

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('OK — email enviado');
console.log('  Desde:', from);
console.log('  Hacia:', to);
console.log('  ID:', data?.id);
