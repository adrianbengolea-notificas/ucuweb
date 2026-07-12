'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Archive,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Filter,
  Gavel,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCw,
  Tags,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import {
  SearchableSelect,
  type SelectOption,
} from '@/components/admin/SearchableSelect';
import type { ReclamoAdminBandeja, ReclamoEmpresa } from '@/types/reclamos';
import type {
  EmpresaCausaCombo,
  RankedCount,
  ReclamoEstadisticas,
  ReclamoEstadisticasFiltrosCatalogos,
} from '@/types/reclamos-stats';

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, 'MMM yyyy', { locale: es });
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'blue',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'blue' | 'green' | 'amber' | 'purple' | 'slate';
}) {
  const accents = {
    blue: 'bg-[#1a5fb4]/10 text-[#1a5fb4]',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {typeof value === 'number' ? value.toLocaleString('es-AR') : value}
          </p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function BarChart({
  items,
  maxItems = 12,
  emptyLabel = 'Sin datos',
  onItemClick,
}: {
  items: RankedCount[];
  maxItems?: number;
  emptyLabel?: string;
  onItemClick?: (item: RankedCount) => void;
}) {
  const visible = items.slice(0, maxItems);
  const max = visible[0]?.count ?? 0;

  if (!visible.length) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2.5">
      {visible.map((item) => {
        const pct = max > 0 ? Math.max(4, (item.count / max) * 100) : 0;
        const clickable = Boolean(onItemClick);
        return (
          <div key={`${item.label}-${item.id ?? ''}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  className="truncate text-left font-medium text-[#1a5fb4] hover:underline"
                  title={`Filtrar por ${item.label}`}
                >
                  {item.label}
                </button>
              ) : (
                <span className="truncate font-medium text-slate-700" title={item.label}>
                  {item.label}
                </span>
              )}
              <span className="shrink-0 tabular-nums font-semibold text-slate-900">
                {item.count.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#1a5fb4] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankedTable({
  items,
  labelHeader,
  showId,
  onItemClick,
  totalBase,
}: {
  items: RankedCount[];
  labelHeader: string;
  showId?: boolean;
  onItemClick?: (item: RankedCount) => void;
  totalBase?: number;
}) {
  if (!items.length) {
    return <p className="py-4 text-center text-sm text-slate-400">Sin datos</p>;
  }

  const base = totalBase ?? items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-slate-500">
            <th className="pb-2 pr-4 font-semibold">#</th>
            {showId && <th className="pb-2 pr-4 font-semibold">ID</th>}
            <th className="pb-2 pr-4 font-semibold">{labelHeader}</th>
            <th className="pb-2 text-right font-semibold">Cantidad</th>
            <th className="pb-2 pl-4 text-right font-semibold">%</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const pct = base > 0 ? ((item.count / base) * 100).toFixed(1) : '0';
            return (
              <tr key={`${item.label}-${item.id ?? index}`} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-4 text-slate-400">{index + 1}</td>
                {showId && (
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{item.id ?? '—'}</td>
                )}
                <td className="max-w-xs py-2 pr-4 font-medium text-slate-800">
                  {onItemClick ? (
                    <button
                      type="button"
                      onClick={() => onItemClick(item)}
                      className="truncate text-left text-[#1a5fb4] hover:underline"
                      title={`Filtrar por ${item.label}`}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className="truncate" title={item.label}>
                      {item.label}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums font-semibold text-slate-900">
                  {item.count.toLocaleString('es-AR')}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums text-slate-500">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmpresaSearchFilter({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (empresaId: string, empresaLabel: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReclamoEmpresa[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/reclamos/catalogos/empresas?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (res.ok) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">Empresa denunciada</span>
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#1a5fb4]/20 bg-[#eef5ff] px-3 py-2 text-sm text-[#1a5fb4]">
          <span className="min-w-0 truncate">{label}</span>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="shrink-0 rounded p-0.5 hover:bg-[#1a5fb4]/10"
            aria-label="Quitar empresa"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Escribí al menos 2 letras…"
          className="field-input"
        />
        {open && query.trim().length >= 2 ? (
          <ul className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {searching ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
              </li>
            ) : results.length ? (
              results.map((empresa) => (
                <li key={empresa.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(String(empresa.id), empresa.nombre);
                      setQuery('');
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    {empresa.nombre}
                    {empresa.cuit ? (
                      <span className="ml-2 text-xs text-slate-400">{empresa.cuit}</span>
                    ) : null}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-sm text-slate-400">Sin resultados</li>
            )}
          </ul>
        ) : null}
      </div>
      {value ? <input type="hidden" value={value} readOnly /> : null}
    </div>
  );
}

function CombosTable({ items, total }: { items: EmpresaCausaCombo[]; total: number }) {
  if (!items.length) {
    return <p className="py-4 text-center text-sm text-slate-400">Sin combinaciones en el período</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-slate-500">
            <th className="pb-2 pr-4 font-semibold">#</th>
            <th className="pb-2 pr-4 font-semibold">Empresa</th>
            <th className="pb-2 pr-4 font-semibold">Causa</th>
            <th className="pb-2 text-right font-semibold">Reclamos</th>
            <th className="pb-2 pl-4 text-right font-semibold">%</th>
            <th className="pb-2 pl-4 font-semibold">Ver caso</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.empresaId}-${item.causaId}`} className="border-b border-slate-50 last:border-0">
              <td className="py-2 pr-4 text-slate-400">{index + 1}</td>
              <td className="max-w-[200px] truncate py-2 pr-4 font-medium text-slate-800" title={item.empresaNombre}>
                {item.empresaNombre}
              </td>
              <td className="max-w-xs truncate py-2 pr-4 text-slate-700" title={item.causaDescripcion}>
                {item.causaDescripcion}
              </td>
              <td className="py-2 text-right tabular-nums font-semibold text-slate-900">
                {item.count.toLocaleString('es-AR')}
              </td>
              <td className="py-2 pl-4 text-right tabular-nums text-slate-500">
                {total > 0 ? ((item.count / total) * 100).toFixed(1) : '0'}%
              </td>
              <td className="py-2 pl-4">
                {item.ejemploReclamoId ? (
                  <Link
                    href={`/admin/reclamos/${item.ejemploReclamoId}`}
                    className="font-semibold text-[#1a5fb4] hover:underline"
                  >
                    #{item.ejemploReclamoId}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReclamosEstadisticasPage() {
  const [stats, setStats] = useState<ReclamoEstadisticas | null>(null);
  const [catalogos, setCatalogos] = useState<ReclamoEstadisticasFiltrosCatalogos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bandeja, setBandeja] = useState<ReclamoAdminBandeja | ''>('');
  const [idGrupoEstado, setIdGrupoEstado] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [empresaLabel, setEmpresaLabel] = useState('');
  const [causaId, setCausaId] = useState('');
  const [idCasoEstado, setIdCasoEstado] = useState('');
  const [provinciaId, setProvinciaId] = useState('');
  const [responsableEmail, setResponsableEmail] = useState('');
  const [sinAsignar, setSinAsignar] = useState(false);
  const [sinResponsable, setSinResponsable] = useState(false);
  const [enJuicio, setEnJuicio] = useState(false);
  const [conExpediente, setConExpediente] = useState(false);
  const [conComunicaciones, setConComunicaciones] = useState(false);
  const [esExterno, setEsExterno] = useState(false);

  const causaOptions = useMemo<SelectOption[]>(
    () => catalogos?.causas.map((c) => ({ value: String(c.id), label: c.descripcion })) ?? [],
    [catalogos]
  );
  const estadoOptions = useMemo<SelectOption[]>(
    () => catalogos?.estados.map((e) => ({ value: String(e.id), label: e.descripcion })) ?? [],
    [catalogos]
  );
  const provinciaOptions = useMemo<SelectOption[]>(
    () => catalogos?.provincias.map((p) => ({ value: String(p.id), label: p.nombre })) ?? [],
    [catalogos]
  );
  const responsableOptions = useMemo<SelectOption[]>(
    () =>
      (stats?.responsablesDisponibles ?? []).map((r) => ({
        value: r.email,
        label: `${r.name} (${r.count})`,
      })),
    [stats?.responsablesDisponibles]
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (bandeja) params.set('bandeja', bandeja);
    if (idGrupoEstado) params.set('idGrupoEstado', idGrupoEstado);
    if (empresaId) params.set('empresaId', empresaId);
    if (causaId) params.set('causaId', causaId);
    if (idCasoEstado) params.set('idCasoEstado', idCasoEstado);
    if (provinciaId) params.set('provinciaId', provinciaId);
    if (responsableEmail) params.set('responsableEmail', responsableEmail);
    if (sinAsignar) params.set('sinAsignar', '1');
    if (sinResponsable) params.set('sinResponsable', '1');
    if (enJuicio) params.set('enJuicio', '1');
    if (conExpediente) params.set('conExpediente', '1');
    if (conComunicaciones) params.set('conComunicaciones', '1');
    if (esExterno) params.set('esExterno', '1');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [
    dateFrom,
    dateTo,
    bandeja,
    idGrupoEstado,
    empresaId,
    causaId,
    idCasoEstado,
    provinciaId,
    responsableEmail,
    sinAsignar,
    sinResponsable,
    enJuicio,
    conExpediente,
    conComunicaciones,
    esExterno,
  ]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reclamos/estadisticas${queryString}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetch('/api/admin/reclamos/estadisticas/filtros', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setCatalogos(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (dateFrom) chips.push({ key: 'dateFrom', label: `Desde ${dateFrom}`, clear: () => setDateFrom('') });
    if (dateTo) chips.push({ key: 'dateTo', label: `Hasta ${dateTo}`, clear: () => setDateTo('') });
    if (bandeja) {
      const labels: Record<string, string> = {
        recibidos: 'Recibidos',
        gestion: 'En gestión',
        archivados: 'Archivados',
      };
      chips.push({ key: 'bandeja', label: labels[bandeja] ?? bandeja, clear: () => setBandeja('') });
    }
    if (idGrupoEstado) {
      const grupoLabels: Record<string, string> = { '1': 'Activos', '2': 'En trámite', '3': 'Archivados' };
      chips.push({
        key: 'grupo',
        label: grupoLabels[idGrupoEstado] ?? `Grupo ${idGrupoEstado}`,
        clear: () => setIdGrupoEstado(''),
      });
    }
    if (empresaId) {
      chips.push({
        key: 'empresa',
        label: empresaLabel || `Empresa #${empresaId}`,
        clear: () => {
          setEmpresaId('');
          setEmpresaLabel('');
        },
      });
    }
    if (causaId) {
      const causa = causaOptions.find((c) => c.value === causaId);
      chips.push({
        key: 'causa',
        label: causa?.label ?? `Causa #${causaId}`,
        clear: () => setCausaId(''),
      });
    }
    if (idCasoEstado) {
      const estado = estadoOptions.find((e) => e.value === idCasoEstado);
      chips.push({
        key: 'estado',
        label: estado?.label ?? `Estado #${idCasoEstado}`,
        clear: () => setIdCasoEstado(''),
      });
    }
    if (provinciaId) {
      const prov = provinciaOptions.find((p) => p.value === provinciaId);
      chips.push({
        key: 'provincia',
        label: prov?.label ?? `Provincia #${provinciaId}`,
        clear: () => setProvinciaId(''),
      });
    }
    if (responsableEmail) {
      const resp = responsableOptions.find((r) => r.value === responsableEmail);
      chips.push({
        key: 'responsable',
        label: resp?.label.split(' (')[0] ?? responsableEmail,
        clear: () => setResponsableEmail(''),
      });
    }
    if (sinAsignar) chips.push({ key: 'sinAsignar', label: 'Sin asignar', clear: () => setSinAsignar(false) });
    if (sinResponsable) {
      chips.push({ key: 'sinResp', label: 'Sin responsable', clear: () => setSinResponsable(false) });
    }
    if (enJuicio) chips.push({ key: 'juicio', label: 'En juicio', clear: () => setEnJuicio(false) });
    if (conExpediente) {
      chips.push({ key: 'exp', label: 'Con expediente', clear: () => setConExpediente(false) });
    }
    if (conComunicaciones) {
      chips.push({ key: 'comms', label: 'Con comunicaciones', clear: () => setConComunicaciones(false) });
    }
    if (esExterno) chips.push({ key: 'ext', label: 'Origen externo', clear: () => setEsExterno(false) });
    return chips;
  }, [
    dateFrom,
    dateTo,
    bandeja,
    idGrupoEstado,
    empresaId,
    empresaLabel,
    causaId,
    causaOptions,
    idCasoEstado,
    estadoOptions,
    provinciaId,
    provinciaOptions,
    responsableEmail,
    responsableOptions,
    sinAsignar,
    sinResponsable,
    enJuicio,
    conExpediente,
    conComunicaciones,
    esExterno,
  ]);

  function clearAllFilters() {
    setDateFrom('');
    setDateTo('');
    setBandeja('');
    setIdGrupoEstado('');
    setEmpresaId('');
    setEmpresaLabel('');
    setCausaId('');
    setIdCasoEstado('');
    setProvinciaId('');
    setResponsableEmail('');
    setSinAsignar(false);
    setSinResponsable(false);
    setEnJuicio(false);
    setConExpediente(false);
    setConComunicaciones(false);
    setEsExterno(false);
  }

  function filterByEmpresa(item: RankedCount) {
    if (!item.id) return;
    setEmpresaId(String(item.id));
    setEmpresaLabel(item.label);
  }

  function filterByCausa(item: RankedCount) {
    if (!item.id) return;
    setCausaId(String(item.id));
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/reclamos" className="text-sm font-semibold text-[#1a5fb4] hover:underline">
          ← Reclamos
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="rounded-lg bg-[#1a5fb4]/10 p-2.5 text-[#1a5fb4]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Estadísticas de reclamos</h1>
            <p className="mt-1 max-w-2xl text-slate-500">
              Análisis por empresa, causa, operador y ubicación. Hacé clic en una fila del ranking
              para filtrar el tablero.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadStats();
        }}
        className="mb-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Filtros</h2>
              <p className="text-xs text-slate-500">
                Combiná criterios para segmentar el universo de reclamos.
              </p>
            </div>
          </div>
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Limpiar todo
            </button>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Período y bandeja</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Desde (alta)</span>
              <input type="date" className="field-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Hasta (alta)</span>
              <input type="date" className="field-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Bandeja</span>
              <select className="field-input" value={bandeja} onChange={(e) => setBandeja(e.target.value as ReclamoAdminBandeja | '')}>
                <option value="">Todas</option>
                <option value="recibidos">Recibidos</option>
                <option value="gestion">En gestión</option>
                <option value="archivados">Archivados</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Grupo de estado</span>
              <select className="field-input" value={idGrupoEstado} onChange={(e) => setIdGrupoEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="2">En trámite / judicial</option>
                <option value="3">Archivados</option>
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa, causa y ubicación</p>
          <div className="grid gap-4 lg:grid-cols-3">
            <EmpresaSearchFilter
              value={empresaId}
              label={empresaLabel}
              onChange={(id, nombre) => {
                setEmpresaId(id);
                setEmpresaLabel(nombre);
              }}
            />
            <SearchableSelect
              label="Causa de reclamo"
              value={causaId}
              options={causaOptions}
              onChange={setCausaId}
              placeholder="Buscar causa…"
              hint={`${causaOptions.length} causas en catálogo`}
            />
            <SearchableSelect
              label="Provincia del denunciante"
              value={provinciaId}
              options={provinciaOptions}
              onChange={setProvinciaId}
              placeholder="Buscar provincia…"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Estado y gestión</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <SearchableSelect
              label="Estado del caso"
              value={idCasoEstado}
              options={estadoOptions}
              onChange={setIdCasoEstado}
              placeholder="Buscar estado…"
              hint={`${estadoOptions.length} estados en catálogo`}
            />
            <SearchableSelect
              label="Operador responsable"
              value={responsableEmail}
              options={responsableOptions}
              onChange={setResponsableEmail}
              placeholder="Buscar operador…"
              hint="Lista según casos asignados en el sistema"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Criterios adicionales</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sinAsignar} onChange={(e) => setSinAsignar(e.target.checked)} className="rounded border-slate-300" />
              Sin asignar (consulta)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sinResponsable} onChange={(e) => setSinResponsable(e.target.checked)} className="rounded border-slate-300" />
              Sin responsable
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enJuicio} onChange={(e) => setEnJuicio(e.target.checked)} className="rounded border-slate-300" />
              En trámite judicial
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={conExpediente} onChange={(e) => setConExpediente(e.target.checked)} className="rounded border-slate-300" />
              Con expediente
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={conComunicaciones} onChange={(e) => setConComunicaciones(e.target.checked)} className="rounded border-slate-300" />
              Con comunicaciones enviadas
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={esExterno} onChange={(e) => setEsExterno(e.target.checked)} className="rounded border-slate-300" />
              Origen externo
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1a5fb4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#004a80] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? 'Calculando…' : 'Actualizar estadísticas'}
        </button>
      </form>

      {activeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Activos:</span>
          {activeFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-medium text-[#1a5fb4] hover:bg-[#dbeafe]"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando estadísticas…
        </div>
      )}

      {stats && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>
              {stats.total.toLocaleString('es-AR')} reclamos
              {activeFilters.length ? ' (filtrados)' : ' en total'}
            </span>
            {stats.rangoFechas.desde && stats.rangoFechas.hasta && (
              <span>
                · Período: {format(new Date(stats.rangoFechas.desde), 'd MMM yyyy', { locale: es })}
                {' — '}
                {format(new Date(stats.rangoFechas.hasta), 'd MMM yyyy', { locale: es })}
              </span>
            )}
            <span>· Calculado {format(new Date(stats.computedAt), 'd MMM yyyy HH:mm', { locale: es })}</span>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total" value={stats.total} icon={BarChart3} />
            <StatCard
              label="Empresas distintas"
              value={stats.resumen.empresasDistintas}
              sub="En el subconjunto filtrado"
              icon={Building2}
              accent="blue"
            />
            <StatCard
              label="Causas distintas"
              value={stats.resumen.causasDistintas}
              sub={`${stats.resumen.conCausas} con causa · ${stats.resumen.sinCausas} sin causa`}
              icon={Tags}
              accent="green"
            />
            <StatCard
              label="Recibidos"
              value={stats.resumen.recibidos}
              sub={`${stats.resumen.sinAsignar} sin asignar`}
              icon={Inbox}
              accent="amber"
            />
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <Section
              title="Por empresa denunciada"
              description={`Top ${stats.porEmpresa.length} empresas · clic para filtrar`}
            >
              <RankedTable
                items={stats.porEmpresa}
                labelHeader="Empresa"
                showId
                onItemClick={filterByEmpresa}
                totalBase={stats.total}
              />
            </Section>
            <Section
              title="Por causa de reclamo"
              description={`Top ${stats.porCausa.length} causas · clic para filtrar`}
            >
              <RankedTable
                items={stats.porCausa}
                labelHeader="Causa"
                showId
                onItemClick={filterByCausa}
                totalBase={stats.total}
              />
            </Section>
          </div>

          <div className="mb-8">
            <Section
              title="Empresa × Causa"
              description="Solo reclamos con una única empresa denunciada. Causas validadas por rubro de la empresa (excluye asignaciones incorrectas del legacy)."
            >
              {stats.resumen.usaValidacionRubros && stats.resumen.causasIncompatiblesRubro > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Se excluyeron {stats.resumen.causasIncompatiblesRubro.toLocaleString('es-AR')}{' '}
                  causas mal asignadas en el SQL legacy (p. ej. «pasaje» en planes de ahorro).
                </div>
              )}
              {stats.resumen.reclamosMultiEmpresa > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {stats.resumen.reclamosMultiEmpresa.toLocaleString('es-AR')} reclamos tienen varias empresas
                  denunciadas y se excluyen de esta tabla para no mezclar causas que no les corresponden.
                  {stats.resumen.reclamosUnaEmpresa > 0
                    ? ` ${stats.resumen.reclamosUnaEmpresa.toLocaleString('es-AR')} casos con una sola empresa sí entran.`
                    : ''}
                </div>
              )}
              <CombosTable items={stats.combosEmpresaCausa} total={stats.total} />
            </Section>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="En gestión" value={stats.resumen.enGestion} icon={Briefcase} accent="blue" />
            <StatCard label="Archivados" value={stats.resumen.archivados} icon={Archive} accent="slate" />
            <StatCard
              label="En trámite judicial"
              value={stats.resumen.enJuicio}
              sub={`${stats.resumen.conExpediente} con expediente`}
              icon={Gavel}
              accent="purple"
            />
            <StatCard
              label="Nuevos (30 días)"
              value={stats.resumen.nuevosUltimos30Dias}
              sub={`${stats.resumen.actualizadosUltimos30Dias} actualizados`}
              icon={TrendingUp}
              accent="green"
            />
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Con comunicaciones"
              value={stats.resumen.conComunicaciones}
              sub={`${stats.resumen.conComunicacionesIA} con borrador IA`}
              icon={Mail}
            />
            <StatCard
              label="Con comentarios"
              value={stats.resumen.conComentarios}
              sub={`Promedio ${stats.resumen.promedioComentarios} por caso`}
              icon={MessageSquare}
              accent="green"
            />
            {stats.tiempoPromedioAsignacionDias != null && (
              <StatCard
                label="Promedio días asignado"
                value={stats.tiempoPromedioAsignacionDias}
                icon={Clock}
              />
            )}
            {stats.tiempoPromedioDesdeCreacionDias != null && (
              <StatCard
                label="Antigüedad promedio"
                value={stats.tiempoPromedioDesdeCreacionDias}
                sub="Días desde el alta"
                icon={Calendar}
              />
            )}
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <Section title="Por estado del caso">
              <BarChart items={stats.porEstado} maxItems={15} />
            </Section>
            <Section title="Por grupo">
              <BarChart items={stats.porGrupo} />
            </Section>
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <Section title="Evolución mensual">
              <BarChart
                items={stats.porMes.map((m) => ({ ...m, label: formatMonthLabel(m.label) }))}
                maxItems={24}
              />
            </Section>
            <Section title="Por año">
              <BarChart items={stats.porAnio} maxItems={15} />
            </Section>
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <Section
              title="Operadores"
              description={`${stats.sinResponsable.toLocaleString('es-AR')} sin responsable`}
            >
              <BarChart items={stats.porResponsable} maxItems={12} />
            </Section>
            <Section title="Por provincia">
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4" />
                Distribución geográfica
              </div>
              <BarChart items={stats.porProvincia} maxItems={12} />
            </Section>
          </div>

          {stats.porCiudad.length > 0 && (
            <div className="mb-8">
              <Section title="Top ciudades">
                <RankedTable items={stats.porCiudad} labelHeader="Ciudad" totalBase={stats.total} />
              </Section>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-slate-400" />
                {stats.porResponsable.length} operadores con casos
              </span>
              <span>{stats.resumen.esExterno.toLocaleString('es-AR')} de origen externo</span>
              <span>{stats.combosEmpresaCausa.length} combos empresa-causa en el top</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
