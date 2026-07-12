'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, MessageCircle } from 'lucide-react';
import { ColaboradorAuthButton } from '@/components/observatorio/ColaboradorAuthButton';
import type { PublicFalloComment } from '@/types/fallo-comments';

function CommentItem({
  comment,
  falloId,
  depth = 0,
  onReply,
}: {
  comment: PublicFalloComment;
  falloId: number;
  depth?: number;
  onReply: (parentId: string) => void;
}) {
  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-ucu-light pl-4' : ''}>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {comment.authorPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.authorPhotoUrl}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ucu-blue text-[10px] font-bold text-white">
              {comment.authorName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="font-semibold text-ucu-dark">{comment.authorName}</span>
          <time className="text-xs text-ucu-gray" dateTime={comment.createdAt}>
            {format(new Date(comment.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
          </time>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-ucu-dark">{comment.content}</p>
        {depth < 2 ? (
          <button
            type="button"
            onClick={() => onReply(comment.id)}
            className="mt-3 text-xs font-semibold text-ucu-magenta hover:underline"
          >
            Responder
          </button>
        ) : null}
      </article>
      {comment.replies?.map((reply) => (
        <div key={reply.id} className="mt-3">
          <CommentItem comment={reply} falloId={falloId} depth={depth + 1} onReply={onReply} />
        </div>
      ))}
    </div>
  );
}

export function FalloCommentSection({ falloId }: { falloId: number }) {
  const [comments, setComments] = useState<PublicFalloComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch('/api/observatorio/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setIsLoggedIn(Boolean(data.colaborador)))
      .catch(() => setIsLoggedIn(false));
  }, []);

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/observatorio/fallo/${falloId}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [falloId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/observatorio/fallo/${falloId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, parentId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar el comentario');
        return;
      }

      setContent('');
      setParentId(null);
      await loadComments();
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return (
    <section className="mt-10 border-t border-slate-200 pt-10" id="comentarios">
      <div className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-ucu-blue" />
        <h2 className="text-2xl font-bold text-ucu-dark">
          Comentarios {totalCount ? `(${totalCount})` : ''}
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-ucu-blue" />
        </div>
      ) : comments.length ? (
        <div className="mb-8 space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              falloId={falloId}
              onReply={(id) => {
                setParentId(id);
                document.getElementById('fallo-comment-form')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ))}
        </div>
      ) : (
        <p className="mb-8 text-sm text-ucu-gray">
          Todavía no hay comentarios. Registrate como colaborador para ser el primero en opinar.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-ucu">
        <h3 className="mb-4 font-semibold text-ucu-dark">
          {isLoggedIn
            ? parentId
              ? 'Responder comentario'
              : 'Dejá tu comentario'
            : 'Comentá como colaborador'}
        </h3>

        {!isLoggedIn ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-ucu-gray">
              Para comentar fallos tenés que registrarte con Google. Cualquier persona puede cargar
              fallos sin registrarse, pero los comentarios y el ranking son para colaboradores
              registrados.
            </p>
            <ColaboradorAuthButton onAuthChange={(profile) => setIsLoggedIn(Boolean(profile))} />
          </div>
        ) : (
          <form id="fallo-comment-form" onSubmit={handleSubmit}>
            {parentId ? (
              <button
                type="button"
                onClick={() => setParentId(null)}
                className="mb-3 text-xs text-ucu-gray hover:text-ucu-blue"
              >
                Cancelar respuesta
              </button>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Comentario *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                minLength={3}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ucu-blue"
                placeholder="Compartí tu análisis, referencias o experiencia sobre este fallo…"
              />
            </div>

            <button type="submit" disabled={submitting} className="ucu-btn-primary disabled:opacity-60">
              {submitting ? 'Enviando…' : 'Publicar comentario'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
