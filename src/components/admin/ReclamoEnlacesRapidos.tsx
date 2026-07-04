'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, FolderOpen, Loader2, Pencil, Scale, X } from 'lucide-react';
import type { ReclamoEnlacesExternos, StoredReclamoDocument } from '@/types/reclamos';
import {
  RECLAMO_ENLACE_FIELDS,
  isReclamoEnJuicio,
  resolveReclamoEnlaces,
} from '@/lib/reclamos-display';

type ReclamoEnlacesRapidosProps = {
  reclamo: StoredReclamoDocument;
  reclamoId: string;
  canWrite: boolean;
  onUpdated: (reclamo: StoredReclamoDocument) => void;
};

type EnlaceChipDef = {
  key: keyof ReclamoEnlacesExternos;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const ENLACE_ICONS: Record<keyof ReclamoEnlacesExternos, React.ReactNode> = {
  drive: <FolderOpen className="h-3.5 w-3.5 text-[#4285F4]" />,
  claude: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#D97757] text-[8px] font-bold text-white">
      C
    </span>
  ),
  chatgpt: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#10A37F] text-[8px] font-bold text-white">
      G
    </span>
  ),
  mev: <Scale className="h-3.5 w-3.5 text-amber-700" />,
  sentencia: <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />,
};

function emptyEnlacesForm(reclamo: StoredReclamoDocument): Record<keyof ReclamoEnlacesExternos, string> {
  const resolved = resolveReclamoEnlaces(reclamo);
  const manual = reclamo.enlacesExternos ?? {};
  return {
    drive: manual.drive ?? resolved.drive ?? '',
    claude: manual.claude ?? resolved.claude ?? '',
    chatgpt: manual.chatgpt ?? resolved.chatgpt ?? '',
    mev: manual.mev ?? resolved.mev ?? '',
    sentencia: manual.sentencia ?? resolved.sentencia ?? '',
  };
}

function EnlaceChip({ enlace }: { enlace: EnlaceChipDef }) {
  return (
    <a
      href={enlace.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1a5fb4]/30 hover:bg-[#f0f6ff] hover:text-[#1a5fb4]"
      title={enlace.href}
    >
      {enlace.icon}
      {enlace.label}
      <ExternalLink className="h-3 w-3 opacity-50" />
    </a>
  );
}

export function ReclamoEnlacesRapidos({
  reclamo,
  reclamoId,
  canWrite,
  onUpdated,
}: ReclamoEnlacesRapidosProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => emptyEnlacesForm(reclamo));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enJuicio = isReclamoEnJuicio(reclamo);
  const resolved = useMemo(() => resolveReclamoEnlaces(reclamo), [reclamo]);

  useEffect(() => {
    if (!editing) setForm(emptyEnlacesForm(reclamo));
  }, [reclamo, editing]);

  const chips: EnlaceChipDef[] = RECLAMO_ENLACE_FIELDS.flatMap((field) => {
    if (field.soloJuicio && !enJuicio) return [];
    const href = resolved[field.key];
    if (!href) return [];
    return [
      {
        key: field.key,
        label: field.label,
        href,
        icon: ENLACE_ICONS[field.key],
      },
    ];
  });

  const editableFields = RECLAMO_ENLACE_FIELDS.filter(
    (field) => !field.soloJuicio || enJuicio || Boolean(form[field.key].trim())
  );

  function updateField(key: keyof ReclamoEnlacesExternos, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const enlacesExternos = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim() || null])
      ) as Partial<ReclamoEnlacesExternos>;

      const res = await fetch(`/api/admin/reclamos/${reclamoId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: { enlacesExternos } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron guardar los enlaces');
      if (data.reclamo) onUpdated(data.reclamo);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((enlace) => (
          <EnlaceChip key={enlace.key} enlace={enlace} />
        ))}
        {canWrite ? (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1a5fb4] hover:bg-[#1a5fb4]/5"
          >
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? 'Cerrar' : chips.length ? 'Editar enlaces' : 'Agregar enlaces'}
          </button>
        ) : null}
      </div>

      {!chips.length && !editing && canWrite ? (
        <p className="mt-2 text-xs text-slate-500">
          Pegá los links específicos de Drive, Claude, ChatGPT o MEV para este caso.
        </p>
      ) : null}

      {editing ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs text-slate-600">
            Copiá el link exacto desde Drive, Claude, ChatGPT o la MEV y pegalo acá.
          </p>
          <div className="space-y-3">
            {editableFields.map((field) => (
              <label key={field.key} className="block text-sm text-slate-700">
                <span className="font-semibold">{field.label}</span>
                <input
                  type="url"
                  value={form[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="field-input mt-1 font-mono text-xs"
                />
              </label>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1a5fb4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004a80] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Guardando…' : 'Guardar enlaces'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
                setForm(emptyEnlacesForm(reclamo));
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
