'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CiudadOption,
  EmpresaOption,
  EtiquetaOption,
  FalloSearchParams,
  JuzgadoOption,
  ProvinciaOption,
  ReclamoOption,
  RubroOption,
  TipoJuicioOption,
} from '@/types/observatorio';

type SelectOption = { value: string; label: string };

type FormState = {
  actor: string;
  rubro: string;
  tipoJuicio: string;
  causas: string;
  etiquetas: string;
  demandado: string;
  idProvincia: string;
  idCiudad: string;
  idTribunal: string;
};

function toFormState(params: FalloSearchParams): FormState {
  return {
    actor: params.actor ?? '',
    rubro: params.rubro ? String(params.rubro) : '',
    tipoJuicio: params.tipoJuicio ? String(params.tipoJuicio) : '',
    causas: params.causas ? String(params.causas) : '',
    etiquetas: params.etiquetas ? String(params.etiquetas) : '',
    demandado: params.demandado ? String(params.demandado) : '',
    idProvincia: params.idProvincia ? String(params.idProvincia) : '',
    idCiudad: params.idCiudad ? String(params.idCiudad) : '',
    idTribunal: params.idTribunal ? String(params.idTribunal) : '',
  };
}

function toQuery(form: FormState): string {
  const query = new URLSearchParams();
  const entries: [keyof FormState, string][] = [
    ['actor', form.actor.trim()],
    ['rubro', form.rubro],
    ['tipoJuicio', form.tipoJuicio],
    ['causas', form.causas],
    ['etiquetas', form.etiquetas],
    ['demandado', form.demandado],
    ['idProvincia', form.idProvincia],
    ['idCiudad', form.idCiudad],
    ['idTribunal', form.idTribunal],
  ];

  for (const [key, value] of entries) {
    if (value) query.set(key, value);
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function fetchDatos<T>(path: string, params?: Record<string, string>): Promise<T> {
  const query = params
    ? `?${new URLSearchParams(params).toString()}`
    : '';
  const response = await fetch(`/api/observatorio/datos/${path}${query}`);
  if (!response.ok) throw new Error(`Error al cargar ${path}`);
  return response.json() as Promise<T>;
}

export function FalloSearchForm({ initialParams }: { initialParams: FalloSearchParams }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initialParams));
  const [loading, setLoading] = useState(true);

  const [rubros, setRubros] = useState<SelectOption[]>([]);
  const [tiposJuicio, setTiposJuicio] = useState<SelectOption[]>([]);
  const [reclamos, setReclamos] = useState<SelectOption[]>([]);
  const [etiquetas, setEtiquetas] = useState<SelectOption[]>([]);
  const [empresas, setEmpresas] = useState<SelectOption[]>([]);
  const [provincias, setProvincias] = useState<SelectOption[]>([]);
  const [ciudades, setCiudades] = useState<SelectOption[]>([]);
  const [juzgados, setJuzgados] = useState<SelectOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      try {
        const [rubrosData, tiposData, reclamosData, etiquetasData, empresasData, provinciasData] =
          await Promise.all([
            fetchDatos<RubroOption[]>('rubros'),
            fetchDatos<TipoJuicioOption[]>('tipojuicio'),
            fetchDatos<ReclamoOption[]>('reclamos'),
            fetchDatos<EtiquetaOption[]>('etiquetas'),
            fetchDatos<EmpresaOption[]>('empresas'),
            fetchDatos<ProvinciaOption[]>('provincias'),
          ]);

        if (cancelled) return;

        setRubros(rubrosData.map((item) => ({ value: String(item.id), label: item.rubro })));
        setTiposJuicio(tiposData.map((item) => ({ value: String(item.id), label: item.nombre })));
        setReclamos(
          reclamosData.map((item) => ({
            value: String(item.id),
            label: item.description,
          }))
        );
        setEtiquetas(
          etiquetasData.map((item) => ({
            value: String(item.id),
            label: item.description,
          }))
        );
        setEmpresas(
          empresasData.map((item) => ({
            value: String(item.id),
            label: item.razon_social,
          }))
        );
        setProvincias(provinciasData.map((item) => ({ value: String(item.id), label: item.nombre })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.idProvincia) {
      setCiudades([]);
      return;
    }

    let cancelled = false;
    fetchDatos<CiudadOption[]>('ciudades', { idProvincia: form.idProvincia })
      .then((data) => {
        if (!cancelled) {
          setCiudades(data.map((item) => ({ value: String(item.id), label: item.nombre })));
        }
      })
      .catch(() => {
        if (!cancelled) setCiudades([]);
      });

    return () => {
      cancelled = true;
    };
  }, [form.idProvincia]);

  useEffect(() => {
    if (!form.idCiudad) {
      setJuzgados([]);
      return;
    }

    let cancelled = false;
    fetchDatos<JuzgadoOption[]>('juzgados', { idCiudad: form.idCiudad })
      .then((data) => {
        if (!cancelled) {
          setJuzgados(data.map((item) => ({ value: String(item.id), label: item.nombre })));
        }
      })
      .catch(() => {
        if (!cancelled) setJuzgados([]);
      });

    return () => {
      cancelled = true;
    };
  }, [form.idCiudad]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'idProvincia') {
        next.idCiudad = '';
        next.idTribunal = '';
      }
      if (key === 'idCiudad') {
        next.idTribunal = '';
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    router.push(`/observatorio/buscar${toQuery(form)}`);
  }

  function handleReset() {
    setForm(toFormState({}));
    router.push('/observatorio/buscar');
  }

  const selectClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#1a5fb4] focus:ring-2 focus:ring-[#1a5fb4]/20 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#2d8f47]">Buscador</p>
        <h2 className="text-2xl font-bold text-slate-900">Filtrar fallos</h2>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando filtros…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Actor / demandante</span>
            <input
              type="text"
              value={form.actor}
              onChange={(event) => updateField('actor', event.target.value)}
              placeholder="Nombre del actor"
              className={selectClass}
            />
          </label>

          <SelectField
            label="Rubro"
            value={form.rubro}
            options={rubros}
            onChange={(value) => updateField('rubro', value)}
            className={selectClass}
          />
          <SelectField
            label="Tipo de juicio"
            value={form.tipoJuicio}
            options={tiposJuicio}
            onChange={(value) => updateField('tipoJuicio', value)}
            className={selectClass}
          />
          <SelectField
            label="Causa de reclamo"
            value={form.causas}
            options={reclamos}
            onChange={(value) => updateField('causas', value)}
            className={selectClass}
          />
          <SelectField
            label="Etiqueta"
            value={form.etiquetas}
            options={etiquetas}
            onChange={(value) => updateField('etiquetas', value)}
            className={selectClass}
          />
          <SelectField
            label="Empresa demandada"
            value={form.demandado}
            options={empresas}
            onChange={(value) => updateField('demandado', value)}
            className={selectClass}
          />
          <SelectField
            label="Provincia"
            value={form.idProvincia}
            options={provincias}
            onChange={(value) => updateField('idProvincia', value)}
            className={selectClass}
          />
          <SelectField
            label="Ciudad"
            value={form.idCiudad}
            options={ciudades}
            onChange={(value) => updateField('idCiudad', value)}
            disabled={!form.idProvincia}
            className={selectClass}
          />
          <SelectField
            label="Tribunal"
            value={form.idTribunal}
            options={juzgados}
            onChange={(value) => updateField('idTribunal', value)}
            disabled={!form.idCiudad}
            className={selectClass}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-full bg-[#1a5fb4] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#154a8c]"
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>
    </form>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
