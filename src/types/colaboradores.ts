export type ColaboradorDocument = {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
  fallosCount: number;
  commentsCount: number;
  score: number;
  createdAt: string;
  lastContributionAt: string;
};

export type PublicColaborador = {
  uid: string;
  name: string;
  photoUrl?: string;
  fallosCount: number;
  commentsCount: number;
  score: number;
};

export type ColaboradorSession = {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
};
