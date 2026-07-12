import 'server-only';

import { Resend } from 'resend';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || key.startsWith('re_REEMPLAZAR')) {
    throw new Error('RESEND_API_KEY no configurada en el entorno del servidor');
  }
  return new Resend(key);
}

function getFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'UCU Usuarios Protegidos <reclamos@ucu.org.ar>'
  );
}

/** Dirección donde el consumidor debe responder (no usar From si no es buzón real). */
export function buildReplyToAddress(reclamoId?: number): string | undefined {
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN?.trim();
  if (inboundDomain && reclamoId) {
    const local = process.env.RESEND_INBOUND_LOCAL_PART?.trim() || 'reclamos';
    return `${local}+${reclamoId}@${inboundDomain}`;
  }

  return process.env.RESEND_REPLY_TO?.trim() || undefined;
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  body: string;
  reclamoId?: number;
};

export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const resend = getResend();
  const html = bodyToHtml(opts.body);
  const replyTo = buildReplyToAddress(opts.reclamoId);

  const { data, error } = await resend.emails.send({
    from: getFromEmail(),
    to: opts.to,
    subject: opts.subject,
    html,
    text: opts.body,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Resend no devolvió ID de mensaje');
  return { id: data.id };
}

export async function fetchReceivedEmailContent(emailId: string): Promise<{
  text?: string | null;
  html?: string | null;
  from?: string;
  subject?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada');

  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const payload = (await response.json()) as {
    text?: string | null;
    html?: string | null;
    from?: string;
    subject?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message || `No se pudo obtener el email recibido (${response.status})`);
  }

  return payload;
}

export function parseReclamoIdFromReplyAddress(addresses: string[]): number | null {
  for (const raw of addresses) {
    const email = raw.includes('<') ? raw.match(/<([^>]+)>/)?.[1] ?? raw : raw;
    const match = email.trim().match(/^reclamos\+(\d+)@/i);
    if (match) return Number(match[1]);
  }
  return null;
}

export function parseReclamoIdFromSubject(subject: string): number | null {
  const match = subject.match(/#(\d{1,8})\b/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export function parseSenderName(fromHeader: string): { email: string; name: string } {
  const match = fromHeader.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, '') || match[2].trim(),
      email: match[2].trim(),
    };
  }
  return { name: fromHeader.trim(), email: fromHeader.trim() };
}

// Convierte texto plano con saltos de línea a HTML simple con el estilo UCU
function bodyToHtml(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => `<p style="margin:0 0 8px 0;line-height:1.6">${escapeHtml(line) || '&nbsp;'}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:#1a5fb4;border-radius:12px 12px 0 0;padding:20px 28px">
            <p style="margin:0;font-size:18px;font-weight:700;color:#fff">UCU — Usuarios Consumidores Unidos</p>
            <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe">Área de Reclamos · Usuarios Protegidos</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:28px;font-size:14px;color:#1e293b">
            ${lines}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:16px 28px;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#64748b">
              UCU · San Nicolás de los Arroyos, Buenos Aires ·
              <a href="https://consumidoresprotegidos.com.ar" style="color:#1a5fb4">consumidoresprotegidos.com.ar</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
