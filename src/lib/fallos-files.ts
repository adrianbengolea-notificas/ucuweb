const FALLO_FILE_PATH = /^\/observatorio\/fallos\/(\d+)\/([^/?#]+)$/;

/** Ruta en Firebase Storage: observatorio/fallos/{expediente}/{filename} */
export function falloStoragePath(expediente: number, filename: string): string {
  return `observatorio/fallos/${expediente}/${filename}`;
}

/** Normaliza URLs almacenadas (absolutas o con espacios) a ruta servible por la app. */
export function resolveFalloFileUrl(
  url: string,
  expediente?: number,
  filename?: string
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('/observatorio/fallos/')) {
    return trimmed;
  }

  const absoluteMatch = trimmed.match(/\/observatorio\/fallos\/(\d+)\/([^/?#]+)/);
  if (absoluteMatch) {
    return `/observatorio/fallos/${absoluteMatch[1]}/${absoluteMatch[2]}`;
  }

  if (expediente && filename) {
    return `/observatorio/fallos/${expediente}/${filename}`;
  }

  return trimmed;
}

export function parseFalloFileRoute(pathname: string): {
  expediente: number;
  filename: string;
} | null {
  const match = pathname.match(FALLO_FILE_PATH);
  if (!match) return null;

  const expediente = Number(match[1]);
  const filename = decodeURIComponent(match[2]);
  if (!Number.isFinite(expediente) || !filename || filename.includes('..')) {
    return null;
  }

  return { expediente, filename };
}
