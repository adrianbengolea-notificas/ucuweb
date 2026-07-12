export type DelegacionStatus = 'publish' | 'draft';

export type Delegado = {
  id: string;
  nombre: string;
  fotoUrl: string | null;
};

export type DelegacionDocument = {
  slug: string;
  nombre: string;
  provincia: string;
  delegados: Delegado[];
  webUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  orden: number;
  status: DelegacionStatus;
  createdAt: string;
  modifiedAt: string;
};

export type DelegacionListItem = Pick<
  DelegacionDocument,
  'slug' | 'nombre' | 'provincia' | 'delegados' | 'status' | 'orden' | 'modifiedAt'
>;
