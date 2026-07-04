'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ReclamoPublicView } from '@/types/reclamos';

export function ReclamoConsultaForm({ initialId = '' }: { initialId?: string }) {
  const [id, setId] = useState(initialId);
  const [documento, setDocumento] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reclamo, setReclamo] = useState<ReclamoPublicView | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setReclamo(null);

    try {
      const params = new URLSearchParams({ id, documento });
      const response = await fetch(`/api/reclamos/consultar?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se encontró el reclamo');
      setReclamo(data.reclamo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Número de reclamo *</span>
            <input
              className="field-input"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Documento *</span>
            <input
              className="field-input"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-lg bg-[#1a5fb4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#004a80] disabled:opacity-60"
        >
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {reclamo && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#2d8f47]">
            Reclamo #{reclamo.id}
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{reclamo.resumen}</h2>
          <p className="mt-4 text-sm text-slate-600">
            <strong>Estado:</strong> {reclamo.estadoDescripcion}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <strong>Última actualización:</strong>{' '}
            {new Date(reclamo.updatedAt).toLocaleString('es-AR')}
          </p>
          {reclamo.empresas.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-800">Empresas denunciadas</p>
              <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                {reclamo.empresas.map((empresa) => (
                  <li key={empresa.id}>{empresa.nombre}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
