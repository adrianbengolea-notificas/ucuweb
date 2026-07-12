import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  fetchReceivedEmailContent,
  parseReclamoIdFromReplyAddress,
  parseReclamoIdFromSubject,
  parseSenderName,
} from '@/lib/email';
import { addReclamoComunicacion } from '@/lib/reclamos-store';

type InboundWebhookEvent = {
  type: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
  };
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error('[resend-inbound] RESEND_WEBHOOK_SECRET no configurada');
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers = {
    id: request.headers.get('svix-id') ?? request.headers.get('webhook-id') ?? '',
    timestamp: request.headers.get('svix-timestamp') ?? request.headers.get('webhook-timestamp') ?? '',
    signature: request.headers.get('svix-signature') ?? request.headers.get('webhook-signature') ?? '',
  };

  let event: InboundWebhookEvent;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    event = resend.webhooks.verify({
      payload: rawBody,
      webhookSecret,
      headers,
    }) as InboundWebhookEvent;
  } catch (error) {
    console.error('[resend-inbound] firma inválida', error);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  if (event.type !== 'email.received' || !event.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const meta = event.data;
    const toAddresses = meta.to ?? [];
    const reclamoId =
      parseReclamoIdFromReplyAddress(toAddresses) ??
      parseReclamoIdFromSubject(meta.subject ?? '');

    if (!reclamoId) {
      console.warn('[resend-inbound] no se pudo asociar reclamo', {
        to: toAddresses,
        subject: meta.subject,
      });
      return NextResponse.json({ ok: true, unmatched: true });
    }

    const received = await fetchReceivedEmailContent(meta.email_id);
    const fromHeader = received.from ?? meta.from ?? 'consumidor';
    const sender = parseSenderName(fromHeader);
    const body = (received.text?.trim() || stripHtml(received.html ?? '')).trim();

    if (!body) {
      return NextResponse.json({ ok: true, empty: true });
    }

    await addReclamoComunicacion(reclamoId, {
      direction: 'inbound',
      from: sender.email,
      to: toAddresses[0] ?? '',
      subject: received.subject ?? meta.subject ?? '(sin asunto)',
      body,
      sentAt: meta.created_at ?? new Date().toISOString(),
      sentByEmail: sender.email,
      sentByName: sender.name,
      viaIA: false,
    });

    return NextResponse.json({ ok: true, reclamoId });
  } catch (error) {
    console.error('[resend-inbound]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error procesando inbound' },
      { status: 500 }
    );
  }
}
