export type FalloCommentDocument = {
  id: string;
  falloId: number;
  parentId: string | null;
  colaboradorUid: string;
  authorName: string;
  authorPhotoUrl?: string;
  content: string;
  createdAt: string;
};

export type PublicFalloComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  authorPhotoUrl?: string;
  content: string;
  createdAt: string;
  replies?: PublicFalloComment[];
};
