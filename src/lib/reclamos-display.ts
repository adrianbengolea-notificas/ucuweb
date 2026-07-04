import type { ReclamoEnlacesExternos, StoredReclamoDocument } from '@/types/reclamos';

export const RECLAMO_GRUPO_JUDICIAL = 2;

export function formatDenuncianteNombre(
  denunciante: StoredReclamoDocument['denunciante']
): string {
  return `${denunciante.nombre} ${denunciante.apellido}`.trim();
}

export function formatDenunciadoNombre(reclamo: StoredReclamoDocument): string | null {
  const empresa = reclamo.empresas[0]?.nombre?.trim();
  if (empresa) return empresa;
  const otras = reclamo.otrasEmpresas?.trim();
  return otras || null;
}

/** Título tipo carátula: "Denunciante c/ Denunciado" */
export function formatReclamoTitulo(reclamo: StoredReclamoDocument): string {
  const denunciante = formatDenuncianteNombre(reclamo.denunciante);
  const denunciado = formatDenunciadoNombre(reclamo);
  if (denunciante && denunciado) return `${denunciante} c/ ${denunciado}`;
  if (denunciante) return denunciante;
  if (denunciado) return `c/ ${denunciado}`;
  return `Reclamo #${reclamo.id}`;
}

export function isReclamoEnJuicio(reclamo: StoredReclamoDocument): boolean {
  return reclamo.idGrupoEstado === RECLAMO_GRUPO_JUDICIAL;
}

export function isValidExternalUrl(value: string | null | undefined): value is string {
  const url = value?.trim();
  return Boolean(url && /^https?:\/\/.+/i.test(url));
}

export function normalizeExternalUrl(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('La URL debe empezar con http:// o https://');
  }
  return trimmed;
}

function resolveEnlace(
  manual: string | undefined,
  legacy: string | undefined
): string | null {
  if (isValidExternalUrl(manual)) return manual.trim();
  if (isValidExternalUrl(legacy)) return legacy.trim();
  return null;
}

export function resolveReclamoEnlaces(reclamo: StoredReclamoDocument): Required<
  Record<keyof ReclamoEnlacesExternos, string | null>
> {
  const manual = reclamo.enlacesExternos ?? {};
  return {
    drive: resolveEnlace(manual.drive, reclamo.googleDrive),
    claude: resolveEnlace(manual.claude, undefined),
    chatgpt: resolveEnlace(manual.chatgpt, undefined),
    mev: resolveEnlace(manual.mev, undefined),
    sentencia: resolveEnlace(manual.sentencia, reclamo.googleDriveSentencia),
  };
}

export const RECLAMO_ENLACE_FIELDS: {
  key: keyof ReclamoEnlacesExternos;
  label: string;
  placeholder: string;
  soloJuicio?: boolean;
}[] = [
  {
    key: 'drive',
    label: 'Google Drive',
    placeholder: 'https://drive.google.com/...',
  },
  {
    key: 'claude',
    label: 'Claude',
    placeholder: 'https://claude.ai/chat/...',
  },
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    placeholder: 'https://chatgpt.com/c/...',
  },
  {
    key: 'mev',
    label: 'MEV',
    placeholder: 'https://mev.scba.gov.ar/...',
    soloJuicio: true,
  },
  {
    key: 'sentencia',
    label: 'Sentencia',
    placeholder: 'https://drive.google.com/...',
  },
];
