'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import type { CommentDocument, CommentStatus } from '@/types/comments';

const tabs: { id: CommentStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'approved', label: 'Aprobados' },
  { id: 'spam', label: 'Spam' },
  { id: 'all', label: 'Todos' },
];

export default function AdminCommentsPage() {
  const [tab, setTab] = useState<CommentStatus | 'all'>('pending');
  const [comments, setComments] = useState<CommentDocument[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<CommentDocument | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/comments?status=${tab}`, { credentials: 'include' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setComments(data.comments || []);
      setPendingCount(data.pendingCount ?? 0);
    } catch (err) {
      setComments([]);
      setPendingCount(0);
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los comentarios');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: CommentStatus) {
    setActionLoading(id);
    await fetch(`/api/admin/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
    setActionLoading(null);
  }

  async function deleteComment(id: string) {
    if (!window.confirm('¿Eliminar este comentario permanentemente?')) return;
    setActionLoading(id);
    await fetch(`/api/admin/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await load();
    setActionLoading(null);
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyingTo || !replyContent.trim()) return;
    setActionLoading('reply');

    await fetch('/api/admin/comments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postSlug: replyingTo.postSlug,
        parentId: replyingTo.id,
        content: replyContent,
      }),
    });

    setReplyingTo(null);
    setReplyContent('');
    await load();
    setActionLoading(null);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Comentarios</h1>
        <p className="mt-1 text-slate-500">
          Moderá y respondé comentarios de las notas
          {pendingCount > 0 ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {pendingCount} pendientes
            </span>
          ) : null}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === item.id
                ? 'bg-ucu-blue text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {replyingTo ? (
        <form
          onSubmit={submitReply}
          className="mb-6 rounded-2xl border border-ucu-blue/30 bg-blue-50 p-5"
        >
          <p className="mb-2 text-sm font-semibold text-ucu-dark">
            Respondiendo a {replyingTo.authorName} en{' '}
            <Link
              href={`/posts/${replyingTo.postSlug}`}
              target="_blank"
              className="text-ucu-blue hover:underline"
            >
              {replyingTo.postTitle || replyingTo.postSlug}
            </Link>
          </p>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={4}
            required
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Respuesta oficial de UCU…"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={actionLoading === 'reply'}
              className="rounded-lg bg-ucu-blue px-4 py-2 text-sm font-semibold text-white"
            >
              Publicar respuesta
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setReplyContent('');
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-ucu-blue" />
        </div>
      ) : !comments.length ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No hay comentarios en esta categoría.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {comment.authorName}
                    {comment.isAdminReply ? (
                      <span className="ml-2 text-xs font-bold uppercase text-ucu-blue">
                        UCU
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(comment.createdAt), "d MMM yyyy HH:mm", { locale: es })}
                    {comment.authorEmail ? ` · ${comment.authorEmail}` : ''}
                  </p>
                  <Link
                    href={`/posts/${comment.postSlug}`}
                    target="_blank"
                    className="text-sm text-ucu-blue hover:underline"
                  >
                    {comment.postTitle || comment.postSlug}
                  </Link>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    comment.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : comment.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {comment.status}
                </span>
              </div>

              <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {comment.content}
              </p>

              <div className="flex flex-wrap gap-2">
                {comment.status !== 'approved' ? (
                  <button
                    type="button"
                    disabled={actionLoading === comment.id}
                    onClick={() => updateStatus(comment.id, 'approved')}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Aprobar
                  </button>
                ) : null}
                {comment.status !== 'spam' ? (
                  <button
                    type="button"
                    disabled={actionLoading === comment.id}
                    onClick={() => updateStatus(comment.id, 'spam')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Spam
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={actionLoading === comment.id}
                  onClick={() => {
                    setReplyingTo(comment);
                    setReplyContent('');
                  }}
                  className="rounded-lg border border-ucu-blue px-3 py-1.5 text-xs font-semibold text-ucu-blue"
                >
                  Responder
                </button>
                <button
                  type="button"
                  disabled={actionLoading === comment.id}
                  onClick={() => deleteComment(comment.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
