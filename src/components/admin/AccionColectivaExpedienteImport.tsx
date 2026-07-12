'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckSquare, FileUp, Loader2, Sparkles, Square } from 'lucide-react';
import type { ExpedienteExtraccionResult, ExpedientePasoExtraido } from '@/types/acciones-colectivas';

type AccionColectivaExpedienteImportProps = {
  slug: string;
  existingUpdateCount: number;
  onImported: () => void;
  disabled?: boolean;
};

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function AccionColectivaExpedienteImport({
  slug,
  existingUpdateCount,
  onImported,
  disabled,
}: AccionColectivaExpedienteImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [extraccion, setExtraccion] = useState<ExpedienteExtraccionResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const canUpload = !disabled && !extracting && !importing && geminiConfigured !== false;

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}/expediente`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) setGeminiConfigured(Boolean(data.geminiConfigured));
    } catch {
      setGeminiConfigured(false);
    }
  }, [slug]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || !canUpload) return;

      if (!isPdfFile(file)) {
        setError('Solo se aceptan archivos PDF');
        return;
      }

      setError('');
      setFileName(file.name);
      setExtracting(true);
      setExtraccion(null);

      try {
        const body = new FormData();
        body.append('pdf', file);

        const res = await fetch(`/api/admin/acciones-colectivas/${slug}/expediente`, {
          method: 'POST',
          credentials: 'include',
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

        const result = data.extraccion as ExpedienteExtraccionResult;
        setExtraccion(result);
        setSelected(new Set(result.pasos.map((_, index) => index)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo analizar el expediente');
      } finally {
        setExtracting(false);
      }
    },
    [canUpload, slug]
  );

  function togglePaso(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (!extraccion) return;
    if (selected.size === extraccion.pasos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(extraccion.pasos.map((_, index) => index)));
    }
  }

  async function handleImport() {
    if (!extraccion || selected.size === 0) return;
    setImporting(true);
    setError('');

    const pasos: ExpedientePasoExtraido[] = extraccion.pasos.filter((_, index) =>
      selected.has(index)
    );

    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}/expediente/importar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pasos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      setExtraccion(null);
      setSelected(new Set());
      setFileName('');
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar los pasos');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            Importar historial desde expediente (IA)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Subí el expediente completo en PDF. La IA detecta los hitos más importantes por fecha y
            arma el historial inicial. Las novedades del día a día las cargás manualmente abajo.
          </p>
          {existingUpdateCount > 0 ? (
            <p className="mt-2 text-sm font-medium text-amber-800">
              Ya hay {existingUpdateCount} actualizaciones: al importar se suman al historial
              existente (no se reemplazan).
            </p>
          ) : null}
          {geminiConfigured === false ? (
            <p className="mt-2 text-sm font-medium text-red-700">
              Falta configurar GEMINI_API_KEY en .env.local
            </p>
          ) : null}
        </div>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (canUpload) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragActive(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (canUpload) e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (!canUpload) return;
          void handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`mt-4 rounded-xl border-2 border-dashed p-6 transition ${
          dragActive ? 'border-violet-500 bg-violet-100/40' : 'border-violet-300 bg-white/70'
        } ${canUpload ? 'cursor-pointer' : 'opacity-60'}`}
        onClick={() => canUpload && inputRef.current?.click()}
        role="button"
        tabIndex={canUpload ? 0 : -1}
        aria-label="Zona para arrastrar o seleccionar PDF del expediente"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:text-left">
          {extracting ? (
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          ) : (
            <FileUp className="h-8 w-8 text-violet-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {extracting
                ? 'Analizando expediente con IA…'
                : dragActive
                  ? 'Soltá el PDF acá'
                  : 'Arrastrá el expediente en PDF o hacé clic para elegir'}
            </p>
            {fileName ? (
              <p className="mt-1 text-sm text-slate-600">{fileName}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">PDF hasta 20 MB</p>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {extraccion ? (
        <div className="mt-5 space-y-4">
          {extraccion.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-semibold">Revisar antes de importar:</p>
              <ul className="mt-1 list-inside list-disc">
                {extraccion.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">
              {extraccion.pasos.length} pasos detectados · {selected.size} seleccionados
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-semibold text-violet-700 hover:underline"
            >
              {selected.size === extraccion.pasos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <ol className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
            {extraccion.pasos.map((paso, index) => (
              <li key={`${paso.fecha}-${index}`}>
                <button
                  type="button"
                  onClick={() => togglePaso(index)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                    selected.has(index)
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-slate-100 bg-slate-50/50 opacity-70'
                  }`}
                >
                  {selected.has(index) ? (
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  ) : (
                    <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {format(new Date(paso.fecha), "d MMM yyyy", { locale: es })}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          paso.importancia === 'alta'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {paso.importancia}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{paso.titulo}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">{paso.descripcion}</p>
                  </div>
                </button>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Importar {selected.size} pasos a la línea de tiempo
          </button>
        </div>
      ) : null}
    </section>
  );
}
