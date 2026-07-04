export type FalloAiExtractedForm = {
  actor: string;
  demandado: string;
  firmActor: boolean;
  personDemandado: boolean;
  resumen: string;
  fecha: string;
  punitivo: string;
  moral: string;
  patrimonial: string;
  divisaId: string;
  tipoJuicioId: string;
  rubroIds: string[];
  causaIds: string[];
  etiquetaIds: string[];
  actorEmpresaIds: string[];
  demandadoEmpresaIds: string[];
  provinciaId: string;
  ciudadId: string;
  juzgadoId: string;
};

export type FalloAiExtractResult = {
  form: FalloAiExtractedForm;
  warnings: string[];
};
