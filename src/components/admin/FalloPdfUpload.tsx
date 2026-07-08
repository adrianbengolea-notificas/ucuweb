'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';

export type FalloPdfDuplicateInfo = {
  nroExpediente: number;
  actor: string | null;
  fecha: string;
  url: string;
};

type FalloPdfUploadProps = {
  onPdfSelected: (pdf: File) => void;
  onPdfCleared?: () => void;
  onDuplicateChange?: (duplicate: FalloPdfDuplicateInfo | null) => void;
  disabled?: boolean;
  description?: string;
  existingPdfLabel?: string | null;
  variant?: 'admin' | 'public';
  required?: boolean;
  checkPdfUrl?: string;
  excludeExpediente?: number;
};

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FalloPdfUpload({
  onPdfSelected,
  onPdfCleared,
  onDuplicateChange,
  disabled,
  description,
  existingPdfLabel,
  variant = 'admin',
  required = false,
  checkPdfUrl = '/api/observatorio/fallos/check-pdf',
  excludeExpediente,
}: FalloPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [duplicate, setDuplicate] = useState<FalloPdfDuplicateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const canSelectPdf = !disabled && !checking;
  const isPublic = variant === 'public';
  const pdfLoaded = Boolean(selectedPdf);
  const pdfAccepted = pdfLoaded && !duplicate && !checking;

  const clearPdf = useCallback(() => {
    setSelectedPdf(null);
    setDuplicate(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onDuplicateChange?.(null);
    onPdfCleared?.();
  }, [onDuplicateChange, onPdfCleared]);

  const selectPdf = useCallback(
    async (file: File | null) => {
      if (!file || !canSelectPdf) return;

      if (!isPdfFile(file)) {
        setError('Solo se aceptan archivos PDF');
        return;
      }

      setError('');
      setDuplicate(null);
      onDuplicateChange?.(null);
      setSelectedPdf(file);
      setChecking(true);

      try {
        const body = new FormData();
        body.append('pdf', file);
        const excludeQuery =
          excludeExpediente != null ? `?exclude=${excludeExpediente}` : '';
        const res = await fetch(`${checkPdfUrl}${excludeQuery}`, {
          method: 'POST',
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

        if (data.duplicate && data.fallo) {
          const match = data.fallo as FalloPdfDuplicateInfo;
          setDuplicate(match);
          onDuplicateChange?.(match);
          onPdfCleared?.();
          return;
        }

        onPdfSelected(file);
      } catch (err) {
        setSelectedPdf(null);
        if (inputRef.current) inputRef.current.value = '';
        setError(err instanceof Error ? err.message : 'No se pudo verificar el PDF');
        onPdfCleared?.();
      } finally {
        setChecking(false);
      }
    },
    [
      canSelectPdf,
      checkPdfUrl,
      excludeExpediente,
      onDuplicateChange,
      onPdfCleared,
      onPdfSelected,
    ]
  );

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (canSelectPdf) setDragActive(true);
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
    if (canSelectPdf) event.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (!canSelectPdf) return;

    const file = event.dataTransfer.files?.[0] ?? null;
    void selectPdf(file);
  }

  const sectionClass = isPublic
    ? 'rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-5'
    : 'rounded-2xl border border-sky-200 bg-sky-50/60 p-5';

  const dropzoneClass = duplicate
    ? 'border-red-400 bg-red-50'
    : pdfAccepted
      ? isPublic
        ? 'border-ucu-green bg-ucu-green/5'
        : 'border-green-400 bg-green-50'
      : dragActive
        ? isPublic
          ? 'border-ucu-blue bg-ucu-blue/5'
          : 'border-[#1a5fb4] bg-[#1a5fb4]/5'
        : isPublic
          ? 'border-[var(--border)] bg-white/80'
          : 'border-sky-300 bg-white/70';

  const buttonClass = isPublic
    ? 'rounded-lg bg-ucu-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ucu-blue/90 disabled:cursor-not-allowed disabled:opacity-60'
    : 'rounded-lg bg-[#1a5fb4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#154a8f] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={
            isPublic ? 'rounded-lg bg-ucu-blue/10 p-2 text-ucu-blue' : 'rounded-lg bg-sky-100 p-2 text-sky-700'
          }
        >
          <FileUp className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className={
              isPublic
                ? 'font-display text-base font-bold text-[var(--ink)]'
                : 'text-base font-semibold text-slate-900'
            }
          >
            PDF del fallo{required ? ' *' : ''}
          </h2>
          <p
            className={
              isPublic
                ? 'mt-1 font-serif text-sm leading-relaxed text-[var(--ink-muted)]'
                : 'mt-1 text-sm text-slate-600'
            }
          >
            {description ??
              'Adjuntá la sentencia en PDF (obligatorio). Se publicará junto con los datos del fallo.'}
          </p>
          {existingPdfLabel ? (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">PDF actual:</span> {existingPdfLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`mt-4 rounded-xl border-2 border-dashed p-6 transition ${dropzoneClass} ${
          canSelectPdf ? '' : 'opacity-60'
        }`}
        aria-label="Zona para arrastrar o seleccionar PDF"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void selectPdf(e.target.files?.[0] ?? null)}
        />

        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {checking ? (
            <Loader2 className={`h-10 w-10 animate-spin ${isPublic ? 'text-ucu-blue' : 'text-[#1a5fb4]'}`} />
          ) : duplicate ? (
            <AlertTriangle className="h-10 w-10 text-red-600" />
          ) : pdfAccepted ? (
            <CheckCircle2 className={`h-10 w-10 ${isPublic ? 'text-ucu-green' : 'text-green-600'}`} />
          ) : (
            <FileUp className={`h-8 w-8 ${isPublic ? 'text-ucu-blue' : 'text-[#1a5fb4]'}`} />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {checking
                ? 'Verificando si el PDF ya está cargado…'
                : duplicate
                  ? 'Este PDF ya existe en el observatorio'
                  : pdfAccepted
                    ? 'PDF listo para publicar'
                    : dragActive
                      ? 'Soltá el PDF acá'
                      : 'Arrastrá el PDF acá'}
            </p>
            {selectedPdf ? (
              <>
                <p className="mt-1 text-sm font-medium text-slate-700">{selectedPdf.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(selectedPdf.size)}</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Solo archivos PDF, hasta 12 MB</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={!canSelectPdf}
              onClick={() => inputRef.current?.click()}
              className={buttonClass}
            >
              {pdfLoaded ? 'Elegir otro PDF' : 'Seleccionar PDF'}
            </button>
            {pdfLoaded ? (
              <button
                type="button"
                disabled={!canSelectPdf}
                onClick={clearPdf}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Quitar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {duplicate ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">
            EXP. {duplicate.nroExpediente}
            {duplicate.actor ? ` — ${duplicate.actor}` : ''}
            {duplicate.fecha ? ` (${duplicate.fecha})` : ''}
          </p>
          <p className="mt-1">
            Este PDF ya fue cargado. No hace falta volver a publicarlo.
          </p>
          <Link
            href={duplicate.url}
            target="_blank"
            className="mt-2 inline-block font-semibold text-red-800 underline hover:text-red-950"
          >
            Ver fallo existente
          </Link>
        </div>
      ) : null}

      {!pdfLoaded && required ? (
        <p className="mt-3 text-xs text-amber-800">Todavía no adjuntaste el PDF de la sentencia.</p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
