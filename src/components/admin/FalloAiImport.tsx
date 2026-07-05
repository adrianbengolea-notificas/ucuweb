'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, Sparkles } from 'lucide-react';
import type { FalloAiExtractedForm } from '@/types/fallo-ai';

type FalloAiImportProps = {
  onExtracted: (result: {
    form: FalloAiExtractedForm;
    warnings: string[];
    pdf: File;
  }) => void;
  disabled?: boolean;
};

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function FalloAiImport({ onExtracted, disabled }: FalloAiImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const canUpload = !disabled && !extracting && geminiConfigured !== false;

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/fallos/ai-extract', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setGeminiConfigured(Boolean(data.geminiConfigured));
    } catch {
      setGeminiConfigured(false);
    }
  }, []);

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

      try {
        const body = new FormData();
        body.append('pdf', file);

        const res = await fetch('/api/admin/fallos/ai-extract', {
          method: 'POST',
          credentials: 'include',
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

        onExtracted({
          form: data.form as FalloAiExtractedForm,
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          pdf: file,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo analizar el PDF');
      } finally {
        setExtracting(false);
      }
    },
    [canUpload, onExtracted]
  );

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (canUpload) setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragActive(false);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (canUpload) event.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (!canUpload) return;

    const file = event.dataTransfer.files?.[0] ?? null;
    void handleFile(file);
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">Cargar con IA desde PDF</h2>
          <p className="mt-1 text-sm text-slate-600">
            Arrastrá la sentencia en PDF o seleccioná el archivo. La IA completa el formulario; el
            resumen destaca qué resolvió el tribunal y sus fundamentos. El PDF queda asociado al
            guardar.
          </p>
          {geminiConfigured === false ? (
            <p className="mt-2 text-sm font-medium text-red-700">
              Falta configurar GEMINI_API_KEY en el servidor
            </p>
          ) : null}
        </div>
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`mt-4 rounded-xl border-2 border-dashed p-6 transition ${
          dragActive
            ? 'border-[#1a5fb4] bg-[#1a5fb4]/5'
            : 'border-sky-300 bg-white/70'
        } ${canUpload ? 'cursor-pointer' : 'opacity-60'}`}
        onClick={() => canUpload && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && canUpload) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={canUpload ? 0 : -1}
        aria-label="Zona para arrastrar o seleccionar PDF"
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
            <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
          ) : (
            <FileUp className="h-8 w-8 text-[#1a5fb4]" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {extracting
                ? 'Analizando PDF…'
                : dragActive
                  ? 'Soltá el PDF acá'
                  : 'Arrastrá el PDF acá o hacé clic para elegir'}
            </p>
            {fileName ? (
              <p className="mt-1 text-sm text-slate-600">{fileName}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Solo archivos PDF, hasta 12 MB</p>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
