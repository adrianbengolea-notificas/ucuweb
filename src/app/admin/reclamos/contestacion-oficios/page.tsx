'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Loader2, Search, Sparkles } from 'lucide-react';
import { useAdminUser } from '@/components/admin/AdminAuth';
import { SearchableMultiSelect } from '@/components/admin/SearchableSelect';
import type { ReclamoCausaCatalog } from '@/types/reclamos';
import type { ReclamoSearchFilters, ReclamoSearchHit, ReclamoSearchStats } from '@/types/reclamos-search';

type IndexMeta = {
  indexedAt: string | null;
  count: number;
  geminiConfigured: boolean;
};

export default function ContestacionOficiosPage() {
  const user = useAdminUser();
  const canWrite = user.permissions.includes('reclamos:write');

  const [meta, setMeta] = useState<IndexMeta | null>(null);
  const [instruction, setInstruction] = useState('');
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [idGrupoEstado, setIdGrupoEstado] = useState('');
  const [causaIds, setCausaIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [causasCatalog, setCausasCatalog] = useState<ReclamoCausaCatalog[]>([]);

  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [interpretacion, setInterpretacion] = useState<string | null>(null);
  const [hits, setHits] = useState<ReclamoSearchHit[]>([]);
  const [stats, setStats] = useState<ReclamoSearchStats | null>(null);
  const [filtersApplied, setFiltersApplied] = useState<ReclamoSearchFilters | null>(null);
  const [truncated, setTruncated] = useState(false);

  const causaOptions = useMemo(
    () =>
      causasCatalog
        .filter((causa) => causa.activo !== false)
        .map((causa) => ({ value: String(causa.id), label: causa.descripcion })),
    [causasCatalog]
  );

  const causaLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const causa of causasCatalog) map.set(causa.id, causa.descripcion);
    return map;
  }, [causasCatalog]);

  const [borrador, setBorrador] = useState('');

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reclamos/contestacion/buscar', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setMeta(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/reclamos/causas', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las causas');
        if (!cancelled) setCausasCatalog(Array.isArray(data.causas) ? data.causas : []);
      })
      .catch(() => {
        if (!cancelled) setCausasCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    setBorrador('');
    setInterpretacion(null);
    setHits([]);
    setStats(null);
    setFiltersApplied(null);

    try {
      const res = await fetch('/api/admin/reclamos/contestacion/buscar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          empresaQuery: empresaQuery.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          idGrupoEstado: idGrupoEstado ? Number(idGrupoEstado) : undefined,
          causaIds: causaIds.map(Number).filter((id) => id > 0),
          keywords: keywords.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      setInterpretacion(data.interpretacion ?? null);
      setHits(data.hits ?? []);
      setStats(data.stats ?? null);
      setFiltersApplied(data.filtersApplied ?? null);
      setTruncated(Boolean(data.truncated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSearching(false);
    }
  }

  async function handleGenerateBorrador() {
    if (!canWrite || !stats || !hits.length) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/reclamos/contestacion/borrador', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          interpretacion,
          stats,
          hits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setBorrador(data.borrador ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/reclamos" className="text-sm font-semibold text-[#1a5fb4] hover:underline">
          ← Reclamos
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="rounded-lg bg-[#1a5fb4]/10 p-2.5 text-[#1a5fb4]">
            <FileText className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contestación de oficios</h1>
            <p className="mt-1 max-w-2xl text-slate-500">
              Describí el oficio o usá los filtros. La empresa y las causas que elijas acotan el
              resultado y pisan lo que interprete la IA (texto editable para el borrador).
            </p>
          </div>
        </div>
      </div>

      {meta && (
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-medium ${
              meta.count > 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            Índice: {meta.count.toLocaleString('es-AR')} reclamos
            {meta.indexedAt
              ? ` · actualizado ${format(new Date(meta.indexedAt), "d MMM yyyy HH:mm", { locale: es })}`
              : ' · sin indexar'}
          </span>
          {meta.geminiConfigured ? (
            <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-800">
              Gemini configurado
            </span>
          ) : null}
        </div>
      )}

      {meta?.count === 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El índice está vacío. En la terminal del proyecto ejecutá:{' '}
          <code className="rounded bg-amber-100 px-1">npm run build:reclamos-index</code>
        </div>
      )}

      <form onSubmit={handleSearch} className="mb-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-800">
            Instrucción para la IA
          </span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            placeholder="Ej.: Reclamos contra FCA por mora en el plan de ahorro…"
            className="field-input min-h-24"
          />
        </label>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-800">Filtros</p>
          <p className="mb-4 text-xs text-slate-500">
            Si cargás empresa o causas acá, la búsqueda se limita a eso. “FCA de ahorro” no trae
            Chevrolet ni Círculo: el rubro “ahorro para fines” es común a todas las administradoras.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Empresa</span>
              <input
                className="field-input"
                value={empresaQuery}
                onChange={(e) => setEmpresaQuery(e.target.value)}
                placeholder="FCA, Fiat Plan, Mercado Libre…"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Estado</span>
              <select
                className="field-input"
                value={idGrupoEstado}
                onChange={(e) => setIdGrupoEstado(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="2">En trámite</option>
                <option value="3">Archivados</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Desde</span>
              <input
                type="date"
                className="field-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Hasta</span>
              <input
                type="date"
                className="field-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SearchableMultiSelect
              label="Causas de reclamo"
              values={causaIds}
              options={causaOptions}
              onChange={setCausaIds}
              placeholder="mora, quita, falta de entrega…"
              hint="Escribí para buscar en el catálogo. Si elegís varias, alcanza con que el reclamo tenga una."
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tema / palabras clave</span>
              <input
                className="field-input"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="cuota, débito, entrega del auto…"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Separá con coma. Se buscan en el resumen y el hecho, no en el nombre de la empresa.
              </span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            searching ||
            (!instruction.trim() &&
              !empresaQuery.trim() &&
              !causaIds.length &&
              !keywords.trim() &&
              !dateFrom &&
              !dateTo &&
              !idGrupoEstado) ||
            (Boolean(instruction.trim()) &&
              !empresaQuery.trim() &&
              !causaIds.length &&
              !meta?.geminiConfigured)
          }
          className="inline-flex items-center gap-2 rounded-lg bg-[#1a5fb4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#004a80] disabled:opacity-60"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {searching ? 'Buscando…' : 'Buscar reclamos'}
        </button>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {(interpretacion || filtersApplied) && (
        <div className="mb-6 space-y-3">
          {interpretacion ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <strong>Interpretación:</strong> {interpretacion}
            </div>
          ) : null}
          {filtersApplied ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {filtersApplied.empresaQuery ? (
                <span className="rounded-full bg-[#eef5ff] px-3 py-1 font-medium text-[#1a5fb4]">
                  Empresa: {filtersApplied.empresaQuery}
                </span>
              ) : null}
              {(filtersApplied.causaIds ?? []).map((id) => (
                <span key={id} className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                  Causa: {causaLabelById.get(id) ?? `#${id}`}
                </span>
              ))}
              {(filtersApplied.causaKeywords ?? []).map((kw) => (
                <span key={kw} className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                  Causa: {kw}
                </span>
              ))}
              {(filtersApplied.keywords ?? []).map((kw) => (
                <span key={kw} className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                  Tema: {kw}
                </span>
              ))}
              {filtersApplied.idGrupoEstado === 1 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Activos</span>
              ) : null}
              {filtersApplied.idGrupoEstado === 2 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">En trámite</span>
              ) : null}
              {filtersApplied.idGrupoEstado === 3 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Archivados</span>
              ) : null}
              {filtersApplied.dateFrom || filtersApplied.dateTo ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                  {filtersApplied.dateFrom || '…'} → {filtersApplied.dateTo || '…'}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {stats && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Resultados ({stats.total.toLocaleString('es-AR')} reclamos)
            {truncated ? ' — mostrando los primeros 500' : ''}
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(stats.porEstado).map(([estado, count]) => (
              <span key={estado} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {estado}: {count}
              </span>
            ))}
          </div>

          {hits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
              No se encontraron reclamos con esos criterios.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nº</th>
                    <th className="px-4 py-3 font-semibold">Empresa</th>
                    <th className="px-4 py-3 font-semibold">Causas</th>
                    <th className="px-4 py-3 font-semibold">Resumen</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.slice(0, 100).map((hit) => (
                    <tr key={hit.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium">{hit.id}</td>
                      <td
                        className="max-w-[200px] truncate px-4 py-3"
                        title={(hit.empresaNombres ?? []).join(', ')}
                      >
                        {(hit.empresaNombres ?? []).join(', ') || '—'}
                      </td>
                      <td
                        className="max-w-[220px] truncate px-4 py-3 text-slate-600"
                        title={(hit.causaTextos ?? []).join(', ')}
                      >
                        {(hit.causaTextos ?? []).join(', ') || '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3" title={hit.resumen}>
                        {hit.resumen}
                      </td>
                      <td className="px-4 py-3">{hit.estadoDescripcion}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {hit.createdAt
                          ? format(new Date(hit.createdAt), 'd MMM yyyy', { locale: es })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/reclamos/${hit.id}`}
                          className="font-semibold text-[#1a5fb4] hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hits.length > 100 && (
                <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                  Mostrando 100 de {hits.length} en pantalla.
                </p>
              )}
            </div>
          )}

          {canWrite && hits.length > 0 && (
            <button
              type="button"
              onClick={handleGenerateBorrador}
              disabled={generating}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2d8f47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f6b31] disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? 'Generando borrador…' : 'Generar borrador de contestación'}
            </button>
          )}
        </section>
      )}

      {(borrador || generating) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-bold text-slate-900">Borrador de contestación</h2>
          <p className="mb-4 text-sm text-slate-500">
            Texto editable. Revisá cifras y redacción antes de usar en un oficio oficial.
          </p>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={18}
            className="field-input min-h-80 font-serif leading-relaxed"
            placeholder={generating ? 'Generando…' : ''}
            disabled={generating}
          />
        </section>
      )}
    </div>
  );
}
