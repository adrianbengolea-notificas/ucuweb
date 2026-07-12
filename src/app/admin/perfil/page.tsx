'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdminUser } from '@/components/admin/AdminAuth';

type DriveStatus = {
  connected: boolean;
  googleEmail?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
};

export default function AdminPerfilPage() {
  const user = useAdminUser();
  const searchParams = useSearchParams();

  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [loadingDrive, setLoadingDrive] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [driveMsg, setDriveMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const status = searchParams.get('driveStatus');
    const reason = searchParams.get('reason');
    if (status === 'connected') {
      setDriveMsg({ type: 'ok', text: 'Google Drive conectado correctamente.' });
    } else if (status === 'error') {
      setDriveMsg({ type: 'error', text: `Error al conectar Drive: ${reason ?? 'desconocido'}` });
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/admin/drive/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: DriveStatus) => setDrive(d))
      .catch(() => setDrive({ connected: false }))
      .finally(() => setLoadingDrive(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch('/api/admin/drive/status', { method: 'DELETE', credentials: 'include' });
      setDrive({ connected: false });
      setDriveMsg({ type: 'ok', text: 'Drive desconectado.' });
    } catch {
      setDriveMsg({ type: 'error', text: 'No se pudo desconectar.' });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
        <p className="mt-1 text-sm text-slate-500">Configuración de tu cuenta de operador.</p>
      </div>

      {/* Datos básicos */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Cuenta</h2>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-slate-500">Nombre</p>
            <p className="mt-0.5 font-medium text-slate-900">{user.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Email</p>
            <p className="mt-0.5 font-medium text-slate-900">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Rol</p>
            <p className="mt-0.5 font-medium text-slate-900 capitalize">{user.role}</p>
          </div>
        </div>
      </section>

      {/* Google Drive */}
      {user.permissions.includes('reclamos:read') && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Google Drive · Sincronización automática
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Al conectar tu cuenta de Google, el sistema puede detectar documentos nuevos en las
            carpetas de Drive vinculadas a tus reclamos y sugerirte actualizaciones automáticas del
            estado del caso via IA.
          </p>

          {driveMsg && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                driveMsg.type === 'ok'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {driveMsg.text}
            </div>
          )}

          <div className="mt-5">
            {loadingDrive ? (
              <p className="text-sm text-slate-400">Verificando conexión…</p>
            ) : drive?.connected ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Drive conectado</p>
                  <p className="text-xs text-slate-600">Cuenta Google: {drive.googleEmail}</p>
                  {drive.lastSyncAt && (
                    <p className="text-xs text-slate-500">
                      Último sync: {new Date(drive.lastSyncAt).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={disconnecting}
                  onClick={() => void handleDisconnect()}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {disconnecting ? 'Desconectando…' : 'Desconectar'}
                </button>
              </div>
            ) : (
              <a
                href="/api/admin/drive/connect"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Conectar con Google Drive
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
