'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, Sparkles } from 'lucide-react';
import type { FalloAiExtractedForm } from '@/types/fallo-ai';

type FalloAiImportProps = {
  onExtracted: (result: { form: FalloAiExtractedForm; warnings: string[] }) => void;
  disabled?: boolean;
};

export function FalloAiImport({ onExtracted, disabled }: FalloAiImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

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

  async function handleFile(file: File | null) {
    if (!file || disabled || extracting) return;

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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar el PDF');
    } finally {
      setExtracting(false);
    }
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
            Subí la sentencia en PDF. La IA completa el formulario y redacta un resumen de hasta 400
            caracteres al centro de la decisión. Revisá y terminá manualmente lo que falte.
          </p>
          {geminiConfigured === false ? (
            <p className="mt-2 text-sm font-medium text-red-700">
              Falta configurar GEMINI_API_KEY en .env.local
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled || extracting || geminiConfigured === false}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1a5fb4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#134a8c] disabled:opacity-60"
        >
          {extracting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {extracting ? 'Analizando PDF…' : 'Seleccionar PDF'}
        </button>
        {fileName ? <span className="text-sm text-slate-600">{fileName}</span> : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
