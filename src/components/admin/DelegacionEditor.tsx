'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RequirePermission } from '@/components/admin/AdminPermissionGuard';
import { resolveMediaUrl } from '@/lib/media';
import { slugify } from '@/lib/slug';
import type { DelegacionDocument, DelegacionStatus } from '@/types/delegaciones';

type DelegadoDraft = {
  id: string;
  nombre: string;
  fotoUrl: string | null;
  photoFile: File | null;
  removePhoto: boolean;
};

type DelegacionEditorProps = {
  mode: 'create' | 'edit';
  initialSlug?: string;
};

function newDelegado(): DelegadoDraft {
  return {
    id: crypto.randomUUID(),
    nombre: '',
    fotoUrl: null,
    photoFile: null,
    removePhoto: false,
  };
}

export function DelegacionEditor({ mode, initialSlug }: DelegacionEditorProps) {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(mode === 'edit');
  const [provincia, setProvincia] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [orden, setOrden] = useState(0);
  const [status, setStatus] = useState<DelegacionStatus>('draft');
  const [delegados, setDelegados] = useState<DelegadoDraft[]>([newDelegado()]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (mode !== 'edit' || !initialSlug) return;

    setLoadingData(true);
    fetch(`/api/admin/delegaciones/${encodeURIComponent(initialSlug)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const delegacion = data.delegacion as DelegacionDocument | undefined;
        if (!delegacion) return;
        setNombre(delegacion.nombre);
        setSlug(delegacion.slug);
        setProvincia(delegacion.provincia);
        setWebUrl(delegacion.webUrl ?? '');
        setFacebookUrl(delegacion.facebookUrl ?? '');
        setInstagramUrl(delegacion.instagramUrl ?? '');
        setTwitterUrl(delegacion.twitterUrl ?? '');
        setEmail(delegacion.email ?? '');
        setTelefono(delegacion.telefono ?? '');
        setDireccion(delegacion.direccion ?? '');
        setOrden(delegacion.orden);
        setStatus(delegacion.status);
        setDelegados(
          delegacion.delegados.length > 0
            ? delegacion.delegados.map((d) => ({
                id: d.id,
                nombre: d.nombre,
                fotoUrl: d.fotoUrl,
                photoFile: null,
                removePhoto: false,
              }))
            : [newDelegado()]
        );
      })
      .catch(() => setError('No se pudo cargar la delegación'))
      .finally(() => setLoadingData(false));
  }, [mode, initialSlug]);

  useEffect(() => {
    if (mode === 'create' && !slugEdited) {
      setSlug(slugify(nombre));
    }
  }, [nombre, mode, slugEdited]);

  function updateDelegado(id: string, patch: Partial<DelegadoDraft>) {
    setDelegados((items) => items.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDelegado(id: string) {
    setDelegados((items) => (items.length <= 1 ? items : items.filter((d) => d.id !== id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const validDelegados = delegados.filter((d) => d.nombre.trim());
    if (validDelegados.length === 0) {
      setError('Agregá al menos un delegado con nombre.');
      setSaving(false);
      return;
    }

    const form = new FormData();
    form.set('nombre', nombre);
    form.set('slug', slug);
    form.set('provincia', provincia);
    form.set('webUrl', webUrl);
    form.set('facebookUrl', facebookUrl);
    form.set('instagramUrl', instagramUrl);
    form.set('twitterUrl', twitterUrl);
    form.set('email', email);
    form.set('telefono', telefono);
    form.set('direccion', direccion);
    form.set('orden', String(orden));
    form.set('status', status);
    form.set(
      'delegados',
      JSON.stringify(
        validDelegados.map((d) => ({
          id: d.id,
          nombre: d.nombre,
          fotoUrl: d.fotoUrl,
          removePhoto: d.removePhoto,
        }))
      )
    );

    for (const delegado of validDelegados) {
      if (delegado.photoFile) {
        form.set(`photo_${delegado.id}`, delegado.photoFile);
      }
    }

    try {
      const url =
        mode === 'create'
          ? '/api/admin/delegaciones'
          : `/api/admin/delegaciones/${encodeURIComponent(initialSlug!)}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, { method, credentials: 'include', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setSuccess('Delegación guardada correctamente.');
      if (mode === 'create') {
        router.push(`/admin/delegaciones/${data.delegacion.slug}/editar`);
      } else if (data.slug && data.slug !== initialSlug) {
        router.replace(`/admin/delegaciones/${data.slug}/editar`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialSlug || !confirm('¿Eliminar esta delegación? Esta acción no se puede deshacer.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/delegaciones/${encodeURIComponent(initialSlug)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      router.push('/admin/delegaciones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
      setDeleting(false);
    }
  }

  if (loadingData) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a5fb4]" />
      </div>
    );
  }

  return (
    <RequirePermission permission="delegaciones:write">
      <div className="max-w-3xl">
        <div className="mb-8">
          <Link
            href="/admin/delegaciones"
            className="text-sm font-medium text-[#1a5fb4] hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            {mode === 'create' ? 'Nueva delegación' : 'Editar delegación'}
          </h1>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Datos generales</h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nombre de la delegación
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="field-input w-full"
                placeholder="Ej. UCU Córdoba Capital"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Provincia</label>
                <input
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  required
                  className="field-input w-full"
                  placeholder="Ej. Córdoba"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Orden</label>
                <input
                  type="number"
                  value={orden}
                  onChange={(e) => setOrden(Number(e.target.value) || 0)}
                  className="field-input w-full"
                  min={0}
                />
                <p className="mt-1 text-xs text-slate-500">Dentro de la misma provincia.</p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                URL (slug)
              </label>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value);
                }}
                className="field-input w-full"
                placeholder="ucu-cordoba-capital"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DelegacionStatus)}
                className="field-input w-full max-w-xs"
              >
                <option value="draft">Borrador</option>
                <option value="publish">Publicada</option>
              </select>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">Delegados</h2>
              <button
                type="button"
                onClick={() => setDelegados((items) => [...items, newDelegado()])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Agregar delegado
              </button>
            </div>

            <div className="space-y-4">
              {delegados.map((delegado, index) => {
                const preview =
                  delegado.photoFile != null
                    ? URL.createObjectURL(delegado.photoFile)
                    : delegado.removePhoto
                      ? null
                      : resolveMediaUrl(delegado.fotoUrl);

                return (
                  <div
                    key={delegado.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Delegado {index + 1}</p>
                      {delegados.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeDelegado(delegado.id)}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Quitar
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                          {preview ? (
                            <Image
                              src={preview}
                              alt={delegado.nombre || 'Delegado'}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <UserRound className="h-10 w-10 text-slate-300" />
                          )}
                        </div>
                        <label className="cursor-pointer text-xs font-semibold text-[#1a5fb4] hover:underline">
                          Cambiar foto
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              updateDelegado(delegado.id, {
                                photoFile: file,
                                removePhoto: false,
                              });
                            }}
                          />
                        </label>
                        {preview ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateDelegado(delegado.id, {
                                photoFile: null,
                                removePhoto: true,
                                fotoUrl: null,
                              })
                            }
                            className="text-xs text-red-600 hover:underline"
                          >
                            Quitar foto
                          </button>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Nombre
                        </label>
                        <input
                          value={delegado.nombre}
                          onChange={(e) => updateDelegado(delegado.id, { nombre: e.target.value })}
                          className="field-input w-full"
                          placeholder="Nombre y apellido"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Contacto y redes</h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Sitio web</label>
              <input
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                className="field-input w-full"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dirección</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="field-input w-full"
                placeholder="Calle, número, localidad"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Facebook</label>
                <input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="field-input w-full"
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Instagram
                </label>
                <input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  className="field-input w-full"
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  X / Twitter
                </label>
                <input
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  className="field-input w-full"
                  placeholder="https://x.com/..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input w-full"
                  placeholder="delegacion@ucu.org.ar"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Teléfono</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="field-input w-full"
                  placeholder="+54 ..."
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2d8f47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f6b31] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </button>

            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </RequirePermission>
  );
}
