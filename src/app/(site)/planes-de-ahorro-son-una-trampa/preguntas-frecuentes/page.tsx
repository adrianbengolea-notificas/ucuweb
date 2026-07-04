import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqAccordion } from '@/components/campaign/FaqAccordion';
import { PageHeader } from '@/components/ui/PageHeader';
import { campaignFaqSections } from '@/lib/campaign-planes-ahorro';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes — Planes de ahorro UCU',
  description:
    'Respuestas sobre contratación, entrega de unidades, aumentos, mora y liquidación final en planes de ahorro automotor.',
};

export default function CampanaFaqPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <PageHeader
        eyebrow="Campaña · Planes de ahorro"
        title="Preguntas frecuentes"
        description="Información práctica para ahorristas sobre contratación, entrega del auto, aumentos de precios, mora y liquidación final."
        backHref="/planes-de-ahorro-son-una-trampa"
        backLabel="Volver a la campaña"
      />
      <FaqAccordion sections={campaignFaqSections} />
      <section className="mt-12 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
        <p className="font-serif text-sm text-[var(--ink-muted)]">
          ¿No encontrás respuesta a tu consulta?
        </p>
        <Link href="/reclamos/nuevo" className="ucu-btn-primary mt-4 inline-flex">
          Contactanos con tu caso
        </Link>
      </section>
    </main>
  );
}
