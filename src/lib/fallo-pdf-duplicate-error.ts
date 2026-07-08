export class DuplicateFalloPdfError extends Error {
  readonly code = 'DUPLICATE_PDF' as const;

  constructor(
    message: string,
    readonly fallo: {
      nroExpediente: number;
      actor: string | null;
      fecha: string;
      url: string;
    }
  ) {
    super(message);
    this.name = 'DuplicateFalloPdfError';
  }
}

export function duplicateFalloPdfMessage(fallo: {
  nroExpediente: number;
  actor: string | null;
}): string {
  const actor = fallo.actor?.trim();
  return actor
    ? `Este fallo ya está cargado en el observatorio (EXP. ${fallo.nroExpediente} — ${actor}).`
    : `Este fallo ya está cargado en el observatorio (EXP. ${fallo.nroExpediente}).`;
}
