'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react';
import { RequirePermission } from '@/components/admin/AdminPermissionGuard';
import { useAdminUser } from '@/components/admin/AdminAuth';
import { AccionColectivaExpedienteImport } from '@/components/admin/AccionColectivaExpedienteImport';
import type {
  AccionColectivaDocument,
  AccionColectivaStatus,
  ActualizacionDocument,
  ActualizacionStatus,
} from '@/types/acciones-colectivas';

function AdminPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default function AccionColectivaDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const user = useAdminUser();
  const canWrite = user.permissions.includes('acciones:write');

  const [accion, setAccion] = useState<AccionColectivaDocument | null>(null);
  const [actualizaciones, setActualizaciones] = useState<ActualizacionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newStatus, setNewStatus] = useState<ActualizacionStatus>('publish');
  const [savingUpdate, setSavingUpdate] = useState(false);

  const [editMeta, setEditMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaSummary, setMetaSummary] = useState('');
  const [metaStatus, setMetaStatus] = useState<AccionColectivaStatus>('draft');
  const [savingMeta, setSavingMeta] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editStatus, setEditStatus] = useState<ActualizacionStatus>('publish');

  const loadAccion = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar acción');
      setAccion(data.accion);
      setActualizaciones(data.accion.actualizaciones || []);
      setMetaTitle(data.accion.title);
      setMetaSummary(data.accion.summary || '');
      setMetaStatus(data.accion.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar acción');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadAccion();
  }, [loadAccion]);

  async function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;
    setSavingUpdate(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}/actualizaciones`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, body: newBody, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar actualización');
      setNewTitle('');
      setNewBody('');
      setNewStatus('publish');
      await loadAccion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar actualización');
    } finally {
      setSavingUpdate(false);
    }
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: metaTitle, summary: metaSummary, status: metaStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setAccion(data.accion);
      setEditMeta(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingMeta(false);
    }
  }

  function startEditUpdate(item: ActualizacionDocument) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body);
    setEditStatus(item.status);
  }

  async function handleSaveEditUpdate(id: string) {
    setSavingUpdate(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}/actualizaciones/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body: editBody, status: editStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar entrada');
      setEditingId(null);
      await loadAccion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar entrada');
    } finally {
      setSavingUpdate(false);
    }
  }

  async function handleDeleteUpdate(id: string) {
    if (!confirm('¿Eliminar esta actualización?')) return;
    setError(null);

    try {
      const res = await fetch(`/api/admin/acciones-colectivas/${slug}/actualizaciones/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      await loadAccion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  if (loading) {
    return (
      <RequirePermission permission="acciones:read">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
        </div>
      </RequirePermission>
    );
  }

  if (!accion) {
    return (
      <RequirePermission permission="acciones:read">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || 'Acción no encontrada.'}
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="acciones:read">
      <div>
        <div className="mb-6">
          <Link
            href="/admin/acciones-colectivas"
            className="text-sm font-medium text-[#1a5fb4] hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{accion.title}</h1>
            {accion.summary ? (
              <p className="mt-2 max-w-2xl text-slate-600">{accion.summary}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {accion.status === 'publish' ? (
              <Link
                href={`/acciones-colectivas/${slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                Ver en el sitio
              </Link>
            ) : null}
            {canWrite ? (
              <button
                type="button"
                onClick={() => setEditMeta(!editMeta)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Editar acción
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {canWrite ? (
              <AccionColectivaExpedienteImport
                slug={slug}
                existingUpdateCount={accion.updateCount}
                onImported={loadAccion}
              />
            ) : null}

            {canWrite ? (
              <AdminPanel title="Nueva novedad (manual)">
                <form onSubmit={handleAddUpdate} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Título (opcional)
                    </label>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="field-input w-full"
                      placeholder="Ej. Audiencia pública confirmada"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Novedad
                    </label>
                    <textarea
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      rows={5}
                      required
                      className="field-input w-full"
                      placeholder="Contá qué pasó, qué hay que hacer, plazos, etc."
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ActualizacionStatus)}
                      className="field-input max-w-xs"
                    >
                      <option value="publish">Publicar ahora</option>
                      <option value="draft">Guardar borrador</option>
                    </select>
                    <button
                      type="submit"
                      disabled={savingUpdate || !newBody.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#1a5fb4] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#134a8a] disabled:opacity-60"
                    >
                      {savingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Agregar a la línea de tiempo
                    </button>
                  </div>
                </form>
              </AdminPanel>
            ) : null}

            <AdminPanel title="Línea de tiempo">
              {actualizaciones.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Todavía no hay actualizaciones. Agregá la primera novedad arriba.
                </p>
              ) : (
                <ol className="space-y-6">
                  {actualizaciones.map((item, index) => (
                    <li key={item.id} className="relative border-l-2 border-[#1a5fb4]/20 pl-6">
                      <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#1a5fb4] shadow-sm" />
                      {index === 0 ? (
                        <span className="mb-2 inline-block rounded-full bg-[#1a5fb4]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1a5fb4]">
                          Más reciente
                        </span>
                      ) : null}

                      {editingId === item.id ? (
                        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="field-input w-full"
                            placeholder="Título (opcional)"
                          />
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={4}
                            className="field-input w-full"
                          />
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as ActualizacionStatus)}
                            className="field-input max-w-xs"
                          >
                            <option value="publish">Publicada</option>
                            <option value="draft">Borrador</option>
                          </select>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEditUpdate(item.id)}
                              disabled={savingUpdate}
                              className="rounded-lg bg-[#1a5fb4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#134a8a] disabled:opacity-60"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                            onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {item.title ? (
                            <p className="text-base font-bold text-slate-900">{item.title}</p>
                          ) : null}
                          <p className="text-xs text-slate-500">
                            {format(new Date(item.publishedAt), "d 'de' MMMM yyyy, HH:mm", {
                              locale: es,
                            })}
                            {item.author?.name ? ` · ${item.author.name}` : ''}
                            {item.source === 'ai' ? (
                              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                                IA
                              </span>
                            ) : (
                              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                Manual
                              </span>
                            )}
                            {item.status === 'draft' ? (
                              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                Borrador
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {item.body}
                          </p>
                          {canWrite ? (
                            <div className="mt-3 flex gap-3">
                              <button
                                type="button"
                                onClick={() => startEditUpdate(item)}
                                className="text-xs font-semibold text-[#1a5fb4] hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUpdate(item.id)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                              >
                                <Trash2 className="h-3 w-3" />
                                Eliminar
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </AdminPanel>
          </div>

          <aside className="space-y-6">
            {editMeta && canWrite ? (
              <AdminPanel title="Editar acción">
                <form onSubmit={handleSaveMeta} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Título
                    </label>
                    <input
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      required
                      className="field-input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Descripción
                    </label>
                    <textarea
                      value={metaSummary}
                      onChange={(e) => setMetaSummary(e.target.value)}
                      rows={3}
                      className="field-input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Estado
                    </label>
                    <select
                      value={metaStatus}
                      onChange={(e) => setMetaStatus(e.target.value as AccionColectivaStatus)}
                      className="field-input w-full"
                    >
                      <option value="draft">Borrador</option>
                      <option value="publish">Publicada</option>
                      <option value="archived">Archivada</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={savingMeta}
                    className="w-full rounded-lg bg-[#2d8f47] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1f6b31] disabled:opacity-60"
                  >
                    {savingMeta ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </form>
              </AdminPanel>
            ) : (
              <AdminPanel title="Resumen">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Estado</dt>
                    <dd className="font-semibold text-slate-900">
                      {metaStatus === 'publish'
                        ? 'Publicada'
                        : metaStatus === 'archived'
                          ? 'Archivada'
                          : 'Borrador'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Actualizaciones publicadas</dt>
                    <dd className="font-semibold text-slate-900">{accion.updateCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">URL pública</dt>
                    <dd className="break-all font-mono text-xs text-slate-700">
                      /acciones-colectivas/{slug}
                    </dd>
                  </div>
                  {accion.expedientePdf ? (
                    <div>
                      <dt className="text-slate-500">Expediente cargado</dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {accion.expedientePdf.filename}
                      </dd>
                      <dd className="text-xs text-slate-500">
                        {format(new Date(accion.expedientePdf.uploadedAt), "d MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </AdminPanel>
            )}
          </aside>
        </div>
      </div>
    </RequirePermission>
  );
}
