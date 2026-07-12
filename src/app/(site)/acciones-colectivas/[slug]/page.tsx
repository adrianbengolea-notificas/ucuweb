import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  getAccionColectivaWithActualizaciones,
  listAccionesColectivasPublic,
} from '@/lib/acciones-colectivas-store';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const accion = await getAccionColectivaWithActualizaciones(slug).catch(() => null);
  if (!accion || accion.status !== 'publish') {
    return { title: 'Acción colectiva — UCU' };
  }
  return {
    title: `${accion.title} — UCU`,
    description: accion.summary || `Novedades y actualizaciones de la acción colectiva: ${accion.title}.`,
  };
}

export default async function AccionColectivaPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const accion = await getAccionColectivaWithActualizaciones(slug).catch(() => null);

  if (!accion || accion.status !== 'publish') notFound();

  const publicadas = accion.actualizaciones.filter((item) => item.status === 'publish');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <PageHeader
        title={accion.title}
        description={accion.summary || 'Seguí las novedades de esta acción colectiva de UCU.'}
      />

      {publicadas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-600">
          Todavía no hay actualizaciones publicadas. Volvé pronto.
        </div>
      ) : (
        <ol className="relative space-y-8 border-l-2 border-[#1a5fb4]/25 pl-8">
          {publicadas.map((item, index) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-[#1a5fb4] shadow-sm" />
              {index === 0 ? (
                <span className="mb-2 inline-block rounded-full bg-[#1a5fb4]/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1a5fb4]">
                  Última novedad
                </span>
              ) : null}
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {item.title ? (
                  <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
                ) : null}
                <time
                  dateTime={item.publishedAt}
                  className="mt-1 block text-sm text-slate-500"
                >
                  {format(new Date(item.publishedAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                </time>
                <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                  {item.body}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-10 text-center">
        <Link
          href="/categoria/acciones-colectivas"
          className="text-sm font-semibold text-[#1a5fb4] hover:underline"
        >
          ← Ver más acciones colectivas
        </Link>
      </div>
    </main>
  );
}
