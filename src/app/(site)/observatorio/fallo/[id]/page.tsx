import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FalloPdfViewer } from '@/components/observatorio/FalloPdfViewer';
import { FalloCommentSection } from '@/components/observatorio/FalloCommentSection';
import { resolveFalloFileUrl } from '@/lib/fallos-files';
import { formatDemandado, formatMonto, getFalloById } from '@/lib/observatorio';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fallo = await getFalloById(Number(id));

  if (!fallo) {
    return { title: 'Fallo no encontrado — Observatorio UCU' };
  }

  return {
    title: `${fallo.actor || 'Fallo'} — Observatorio UCU`,
    description: fallo.resumen?.slice(0, 160) || 'Detalle del fallo jurisprudencial.',
  };
}

export default async function FalloDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const nroExpediente = Number(id);
  if (!Number.isFinite(nroExpediente)) notFound();

  const fallo = await getFalloById(nroExpediente);
  if (!fallo) notFound();

  const demandado = formatDemandado(fallo);
  const monto = formatMonto(fallo);
  const viewerFiles = fallo.files.map((file) => ({
    id: file.id,
    file: file.file,
    url: resolveFalloFileUrl(file.url, fallo.nroExpediente, file.file),
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/observatorio/buscar"
        className="mb-6 inline-block text-sm text-[#1a5fb4] hover:underline"
      >
        ← Volver al buscador
      </Link>

      <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          {fallo.actor || 'Actor no especificado'}
        </h1>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <DetailItem label="Demandado" value={demandado} />
          <DetailItem label="Fecha" value={fallo.fecha} />
          <DetailItem label="Tipo de juicio" value={fallo.tipoJuicio?.nombre} />
          <DetailItem label="Tribunal" value={fallo.juzgado?.nombre} />
          <DetailItem
            label="Ubicación"
            value={[fallo.ciudad?.nombre, fallo.provincia?.nombre].filter(Boolean).join(', ') || undefined}
          />
          {monto ? <DetailItem label="Monto" value={monto} /> : null}
        </dl>

        {fallo.rubro.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Rubros
            </h2>
            <div className="flex flex-wrap gap-2">
              {fallo.rubro.map((item) => (
                <span
                  key={item.id}
                  className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#1a5fb4]"
                >
                  {item.nombre}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {fallo.causas.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Causas de reclamo
            </h2>
            <div className="flex flex-wrap gap-2">
              {fallo.causas.map((item) => (
                <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {item.nombre}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Resumen
          </h2>
          <p className="text-base leading-8 text-slate-700">
            {fallo.resumen || 'No se proporcionó resumen para este fallo.'}
          </p>
        </section>

        {viewerFiles.length ? <FalloPdfViewer files={viewerFiles} /> : null}

        {fallo.etiquetas.length ? (
          <section className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Etiquetas
            </h2>
            <div className="flex flex-wrap gap-2">
              {fallo.etiquetas.map((item) => (
                <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {item.nombre}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {fallo.submittedBy ? (
          <p className="mt-6 text-sm text-slate-500">
            Aportado por{' '}
            <span className="font-medium text-slate-700">{fallo.submittedBy.name}</span>
          </p>
        ) : null}
      </article>

      <FalloCommentSection falloId={fallo.nroExpediente} />
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</dd>
    </div>
  );
}
