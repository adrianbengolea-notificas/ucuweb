'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { FalloPdfUpload, type FalloPdfDuplicateInfo } from '@/components/admin/FalloPdfUpload';
import type { FalloAiExtractedForm } from '@/types/fallo-ai';

type FalloAiImportProps = {
  onPdfSelected: (pdf: File) => void;
  onPdfCleared?: () => void;
  onDuplicateChange?: (duplicate: FalloPdfDuplicateInfo | null) => void;
  onExtracted?: (result: { form: FalloAiExtractedForm; warnings: string[] }) => void;
  disabled?: boolean;
  existingPdfLabel?: string | null;
  excludeExpediente?: number;
};

export function FalloAiImport({
  onPdfSelected,
  onPdfCleared,
  onDuplicateChange,
  onExtracted,
  disabled,
  existingPdfLabel,
  excludeExpediente,
}: FalloAiImportProps) {
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);

  const canAnalyzeWithAi =
    Boolean(onExtracted) && !disabled && !extracting && geminiConfigured === true && Boolean(selectedPdf);

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

  const handlePdfSelected = useCallback(
    (pdf: File) => {
      setSelectedPdf(pdf);
      onPdfSelected(pdf);
    },
    [onPdfSelected]
  );

  const handlePdfCleared = useCallback(() => {
    setSelectedPdf(null);
    onPdfCleared?.();
  }, [onPdfCleared]);

  const analyzeWithAi = useCallback(async () => {
    if (!selectedPdf || !canAnalyzeWithAi || !onExtracted) return;

    setError('');
    setExtracting(true);

    try {
      const body = new FormData();
      body.append('pdf', selectedPdf);

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
  }, [canAnalyzeWithAi, onExtracted, selectedPdf]);

  return (
    <div className="space-y-4">
      <FalloPdfUpload
        disabled={disabled || extracting}
        excludeExpediente={excludeExpediente}
        existingPdfLabel={existingPdfLabel}
        onPdfSelected={handlePdfSelected}
        onPdfCleared={handlePdfCleared}
        onDuplicateChange={onDuplicateChange}
        description="Arrastrá la sentencia en PDF o usá el botón para elegir el archivo. Se guardará junto con el expediente. Si tenés IA configurada, podés completar el formulario automáticamente."
      />

      {geminiConfigured === false ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La IA no está disponible (falta GEMINI_API_KEY). Igual podés subir el PDF manualmente.
        </p>
      ) : null}

      {onExtracted && geminiConfigured ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canAnalyzeWithAi}
            onClick={() => void analyzeWithAi()}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Completar formulario con IA
          </button>
          {!selectedPdf ? (
            <p className="text-xs text-slate-500">Seleccioná un PDF para habilitar el análisis con IA.</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
