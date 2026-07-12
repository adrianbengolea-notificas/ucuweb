import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { listAccionesColectivasPublic } from '@/lib/acciones-colectivas-store';

export const metadata: Metadata = {
  title: 'Acciones colectivas — UCU',
  description:
    'Seguí en tiempo real las novedades de las acciones colectivas importantes de Usuarios y Consumidores Unidos.',
};

export default async function AccionesColectivasIndexPage() {
  const acciones = await listAccionesColectivasPublic().catch(() => []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <PageHeader
        title="Acciones colectivas"
        description="Novedades y actualizaciones de las campañas y acciones colectivas de UCU."
      />

      {acciones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-600">
          No hay acciones con novedades publicadas por el momento.
        </div>
      ) : (
        <ul className="space-y-4">
          {acciones.map((accion) => (
            <li key={accion.slug}>
              <Link
                href={`/acciones-colectivas/${accion.slug}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1a5fb4]/40 hover:shadow-md"
              >
                <h2 className="text-lg font-bold text-slate-900">{accion.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {accion.updateCount}{' '}
                  {accion.updateCount === 1 ? 'actualización' : 'actualizaciones'}
                  {accion.lastUpdateAt
                    ? ` · Última: ${format(new Date(accion.lastUpdateAt), "d MMM yyyy", { locale: es })}`
                    : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
