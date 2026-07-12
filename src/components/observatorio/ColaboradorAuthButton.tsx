'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { signInWithGoogleIdToken, signOutFromGoogle } from '@/lib/firebase-auth';

type ColaboradorProfile = {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
  fallosCount: number;
  commentsCount: number;
  score: number;
};

type ColaboradorAuthButtonProps = {
  compact?: boolean;
  onAuthChange?: (colaborador: ColaboradorProfile | null) => void;
};

export function ColaboradorAuthButton({ compact = false, onAuthChange }: ColaboradorAuthButtonProps) {
  const [colaborador, setColaborador] = useState<ColaboradorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/observatorio/auth/me', { credentials: 'include' });
      const data = await res.json();
      const profile = data.colaborador ?? null;
      setColaborador(profile);
      onAuthChange?.(profile);
    } finally {
      setLoading(false);
    }
  }, [onAuthChange]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function handleLogin() {
    setSubmitting(true);
    setError('');
    try {
      const idToken = await signInWithGoogleIdToken();
      const res = await fetch('/api/observatorio/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo iniciar sesión');
        return;
      }
      setColaborador(data.colaborador);
      onAuthChange?.(data.colaborador);
    } catch {
      setError('No se pudo conectar con Google');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setSubmitting(true);
    setError('');
    try {
      await fetch('/api/observatorio/auth/logout', { method: 'POST', credentials: 'include' });
      await signOutFromGoogle();
      setColaborador(null);
      onAuthChange?.(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        {!compact ? 'Cargando sesión…' : null}
      </div>
    );
  }

  if (colaborador) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {colaborador.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={colaborador.photoUrl}
              alt=""
              className="h-8 w-8 rounded-full border border-[var(--border)] object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ucu-blue text-xs font-bold text-white">
              {colaborador.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-display text-sm font-semibold text-[var(--ink)]">{colaborador.name}</p>
            {!compact ? (
              <p className="font-display text-xs text-[var(--ink-muted)]">
                {colaborador.score} pts · {colaborador.fallosCount} fallos · {colaborador.commentsCount}{' '}
                comentarios
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 font-display text-xs font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </button>
      </div>
    );
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleLogin}
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-white px-4 py-2.5 font-display text-sm font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Registrarse con Google
      </button>
    </div>
  );
}

export function useColaboradorSession() {
  const [colaborador, setColaborador] = useState<ColaboradorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/observatorio/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setColaborador(data.colaborador ?? null))
      .finally(() => setLoading(false));
  }, []);

  return { colaborador, loading };
}
