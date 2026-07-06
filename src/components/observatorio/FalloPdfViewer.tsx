'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { isFalloPdfFile } from '@/lib/fallos-files';

export type FalloViewerFile = {
  id: number;
  file: string;
  url: string;
};

type FalloPdfViewerProps = {
  files: FalloViewerFile[];
};

export function FalloPdfViewer({ files }: FalloPdfViewerProps) {
  const pdfFiles = files.filter((file) => isFalloPdfFile(file.file));
  const otherFiles = files.filter((file) => !isFalloPdfFile(file.file));

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeFile = pdfFiles[activeIndex] ?? null;

  useEffect(() => {
    setIsLoading(true);
  }, [activeFile?.url]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }, []);

  if (!pdfFiles.length && !otherFiles.length) return null;

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Documentos
      </h2>

      {pdfFiles.length ? (
        <div
          ref={containerRef}
          className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm ${
            isFullscreen ? 'flex h-screen flex-col' : ''
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-[#1a5fb4]" aria-hidden />
              <p className="truncate text-sm font-semibold text-slate-800">
                {activeFile?.file}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pdfFiles.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {pdfFiles.map((file, index) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        index === activeIndex
                          ? 'bg-[#1a5fb4] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeFile ? (
                <a
                  href={activeFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1a5fb4] hover:text-[#1a5fb4]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Abrir
                </a>
              ) : null}

              <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1a5fb4] hover:text-[#1a5fb4]"
                aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                )}
                {isFullscreen ? 'Salir' : 'Pantalla completa'}
              </button>
            </div>
          </div>

          <div className={`relative bg-slate-200 ${isFullscreen ? 'min-h-0 flex-1' : 'h-[min(75vh,900px)]'}`}>
            {isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80">
                <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" aria-hidden />
                <span className="sr-only">Cargando documento…</span>
              </div>
            ) : null}

            {activeFile ? (
              <iframe
                key={activeFile.url}
                src={`${activeFile.url}#view=FitH`}
                title={`Vista previa: ${activeFile.file}`}
                className="h-full w-full border-0 bg-white"
                onLoad={() => setIsLoading(false)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {otherFiles.length ? (
        <ul className={`space-y-2 ${pdfFiles.length ? 'mt-4' : ''}`}>
          {otherFiles.map((file) => (
            <li key={file.id}>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a5fb4] hover:underline"
              >
                <FileText className="h-4 w-4" aria-hidden />
                {file.file}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
