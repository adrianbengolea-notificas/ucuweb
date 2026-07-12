export type AccionColectivaStatus = 'publish' | 'draft' | 'archived';

export type ActualizacionStatus = 'publish' | 'draft';

export type ActualizacionSource = 'manual' | 'ai';

export type AccionColectivaAuthor = {
  name: string;
  email: string;
};

export type ExpedientePdf = {
  filename: string;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: AccionColectivaAuthor;
};

export type AccionColectivaDocument = {
  slug: string;
  title: string;
  summary: string;
  status: AccionColectivaStatus;
  createdAt: string;
  modifiedAt: string;
  lastUpdateAt: string | null;
  updateCount: number;
  expedientePdf?: ExpedientePdf | null;
};

export type ActualizacionDocument = {
  id: string;
  title: string;
  body: string;
  status: ActualizacionStatus;
  source: ActualizacionSource;
  publishedAt: string;
  createdAt: string;
  modifiedAt: string;
  author: AccionColectivaAuthor;
};

export type ExpedientePasoExtraido = {
  fecha: string;
  titulo: string;
  descripcion: string;
  importancia: 'alta' | 'media' | 'baja';
};

export type ExpedienteExtraccionResult = {
  tituloSugerido: string | null;
  resumenSugerido: string | null;
  pasos: ExpedientePasoExtraido[];
  warnings: string[];
};

export type AccionColectivaListItem = Pick<
  AccionColectivaDocument,
  'slug' | 'title' | 'status' | 'lastUpdateAt' | 'updateCount' | 'modifiedAt'
>;

export type AccionColectivaWithActualizaciones = AccionColectivaDocument & {
  actualizaciones: ActualizacionDocument[];
};
