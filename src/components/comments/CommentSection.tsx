'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, MessageCircle } from 'lucide-react';
import type { PublicComment } from '@/types/comments';

function CommentItem({
  comment,
  postSlug,
  depth = 0,
  onReply,
}: {
  comment: PublicComment;
  postSlug: string;
  depth?: number;
  onReply: (parentId: string) => void;
}) {
  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-ucu-light pl-4' : ''}>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`font-semibold ${comment.isAdminReply ? 'text-ucu-blue' : 'text-ucu-dark'}`}
          >
            {comment.authorName}
          </span>
          {comment.isAdminReply ? (
            <span className="rounded-full bg-ucu-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ucu-blue">
              UCU
            </span>
          ) : null}
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
          <CommentItem comment={reply} postSlug={postSlug} depth={depth + 1} onReply={onReply} />
        </div>
      ))}
    </div>
  );
}

export function CommentSection({ postSlug }: { postSlug: string }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [content, setContent] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [company, setCompany] = useState('');

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postSlug)}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [postSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postSlug)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName,
          authorEmail,
          content,
          parentId,
          company,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar el comentario');
        return;
      }

      setMessage(data.message || 'Comentario enviado');
      setContent('');
      setParentId(null);
      setCompany('');
      if (!data.pending) await loadComments();
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length || 0),
    0
  );

  return (
    <section className="mt-12 border-t border-slate-200 pt-10" id="comentarios">
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
              postSlug={postSlug}
              onReply={(id) => {
                setParentId(id);
                document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ))}
        </div>
      ) : (
        <p className="mb-8 text-sm text-ucu-gray">
          Todavía no hay comentarios. Sé el primero en opinar.
        </p>
      )}

      <form
        id="comment-form"
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-ucu"
      >
        <h3 className="mb-4 font-semibold text-ucu-dark">
          {parentId ? 'Responder comentario' : 'Dejá tu comentario'}
        </h3>

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
        {message ? (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre *</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ucu-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email (opcional)</label>
            <input
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ucu-blue"
            />
          </div>
        </div>

        <div className="mb-4 hidden" aria-hidden>
          <input
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Comentario *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            minLength={3}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ucu-blue"
            placeholder="Escribí tu comentario…"
          />
        </div>

        <p className="mb-4 text-xs text-ucu-gray">
          Los comentarios se publican después de una revisión moderada.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="ucu-btn-primary disabled:opacity-60"
        >
          {submitting ? 'Enviando…' : 'Enviar comentario'}
        </button>
      </form>
    </section>
  );
}
