'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RequirePermission } from '@/components/admin/AdminPermissionGuard';
import type { AccionColectivaStatus } from '@/types/acciones-colectivas';

export default function NuevaAccionColectivaPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<AccionColectivaStatus>('draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/acciones-colectivas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, slug: slug || undefined, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear acción');
      router.push(`/admin/acciones-colectivas/${data.accion.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear acción');
      setSaving(false);
    }
  }

  return (
    <RequirePermission permission="acciones:write">
      <div className="max-w-2xl">
        <div className="mb-8">
          <Link
            href="/admin/acciones-colectivas"
            className="text-sm font-medium text-[#1a5fb4] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Nueva acción colectiva</h1>
          <p className="mt-1 text-slate-500">
            Creá la acción y luego agregá actualizaciones en su línea de tiempo.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="field-input w-full"
              placeholder="Ej. Reforma de planes de ahorro 2026"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Descripción breve
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="field-input w-full"
              placeholder="Contexto inicial de la acción (opcional)…"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              URL (slug, opcional)
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="field-input w-full"
              placeholder="reforma-planes-2026"
            />
            <p className="mt-1 text-xs text-slate-500">
              Si lo dejás vacío se genera automáticamente desde el título.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AccionColectivaStatus)}
              className="field-input w-full max-w-xs"
            >
              <option value="draft">Borrador</option>
              <option value="publish">Publicada</option>
              <option value="archived">Archivada</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2d8f47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f6b31] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear y abrir línea de tiempo
          </button>
        </form>
      </div>
    </RequirePermission>
  );
}
