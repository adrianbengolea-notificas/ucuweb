'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { RequirePermission } from '@/components/admin/AdminPermissionGuard';
import type { DelegacionListItem } from '@/types/delegaciones';

const STATUS_LABELS: Record<string, string> = {
  publish: 'Publicada',
  draft: 'Borrador',
};

const STATUS_CLASSES: Record<string, string> = {
  publish: 'bg-green-100 text-green-800',
  draft: 'bg-slate-100 text-slate-600',
};

export default function AdminDelegacionesPage() {
  const [delegaciones, setDelegaciones] = useState<DelegacionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/admin/delegaciones', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setDelegaciones(data.delegaciones || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = delegaciones.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.nombre.toLowerCase().includes(q) ||
      item.provincia.toLowerCase().includes(q) ||
      item.delegados.some((d) => d.nombre.toLowerCase().includes(q))
    );
  });

  return (
    <RequirePermission permission="delegaciones:read">
      <div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Delegaciones</h1>
            <p className="mt-1 text-slate-500">
              Gestioná las delegaciones provinciales, delegados y enlaces de contacto.
            </p>
          </div>
          <Link
            href="/admin/delegaciones/nueva"
            className="rounded-lg bg-[#2d8f47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f6b31]"
          >
            + Nueva delegación
          </Link>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, provincia o delegado…"
          className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a5fb4]"
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-slate-600">Todavía no hay delegaciones registradas.</p>
            <Link
              href="/admin/delegaciones/nueva"
              className="mt-4 inline-block text-sm font-semibold text-[#1a5fb4] hover:underline"
            >
              Crear la primera delegación
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Delegación</th>
                  <th className="px-4 py-3 font-semibold">Provincia</th>
                  <th className="px-4 py-3 font-semibold">Delegados</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.slug} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{item.provincia}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.delegados.map((d) => d.nombre).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_CLASSES[item.status] ?? STATUS_CLASSES.draft
                        }`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/delegaciones/${item.slug}/editar`}
                          className="font-semibold text-[#1a5fb4] hover:underline"
                        >
                          Editar
                        </Link>
                        {item.status === 'publish' ? (
                          <Link
                            href="/delegaciones"
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
