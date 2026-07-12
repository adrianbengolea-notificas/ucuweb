'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, Loader2 } from 'lucide-react';
import { RequirePermission } from '@/components/admin/AdminPermissionGuard';
import type { AccionColectivaListItem } from '@/types/acciones-colectivas';

const STATUS_LABELS: Record<string, string> = {
  publish: 'Publicada',
  draft: 'Borrador',
  archived: 'Archivada',
};

const STATUS_CLASSES: Record<string, string> = {
  publish: 'bg-green-100 text-green-800',
  draft: 'bg-slate-100 text-slate-600',
  archived: 'bg-amber-100 text-amber-800',
};

export default function AdminAccionesColectivasPage() {
  const [acciones, setAcciones] = useState<AccionColectivaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/admin/acciones-colectivas', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setAcciones(data.acciones || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = acciones.filter((accion) =>
    accion.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <RequirePermission permission="acciones:read">
      <div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Acciones colectivas</h1>
            <p className="mt-1 text-slate-500">
              Informá novedades en la línea de tiempo de cada acción importante.
            </p>
          </div>
          <Link
            href="/admin/acciones-colectivas/nueva"
            className="rounded-lg bg-[#2d8f47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f6b31]"
          >
            + Nueva acción
          </Link>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título…"
          className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a5fb4]"
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-slate-600">Todavía no hay acciones colectivas registradas.</p>
            <Link
              href="/admin/acciones-colectivas/nueva"
              className="mt-4 inline-block text-sm font-semibold text-[#1a5fb4] hover:underline"
            >
              Crear la primera acción
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Título</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Actualizaciones</th>
                  <th className="px-4 py-3 font-semibold">Última novedad</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((accion) => (
                  <tr key={accion.slug} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{accion.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_CLASSES[accion.status] ?? STATUS_CLASSES.draft
                        }`}
                      >
                        {STATUS_LABELS[accion.status] ?? accion.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{accion.updateCount}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {accion.lastUpdateAt
                        ? format(new Date(accion.lastUpdateAt), 'd MMM yyyy HH:mm', { locale: es })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/acciones-colectivas/${accion.slug}`}
                          className="font-semibold text-[#1a5fb4] hover:underline"
                        >
                          Ver línea de tiempo
                        </Link>
                        {accion.status === 'publish' ? (
                          <Link
                            href={`/acciones-colectivas/${accion.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-[#1a5fb4]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Sitio
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
