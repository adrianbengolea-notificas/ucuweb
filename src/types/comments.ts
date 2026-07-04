export type CommentStatus = 'pending' | 'approved' | 'spam' | 'trash';

export type CommentDocument = {
  id: string;
  postSlug: string;
  postTitle?: string;
  parentId: string | null;
  authorName: string;
  authorEmail?: string;
  content: string;
  status: CommentStatus;
  isAdminReply: boolean;
  adminAuthor?: string;
  createdAt: string;
  wpCommentId?: number;
};

export type PublicComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  content: string;
  isAdminReply: boolean;
  createdAt: string;
  replies?: PublicComment[];
};
