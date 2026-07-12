'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAdminUser } from '@/components/admin/AdminAuth';
import { cn } from '@/lib/utils';

type ReclamoAlertCounts = {
  recibidos: number;
  gestion: number;
  archivados: number;
  assignedCount: number;
};

type ReclamoAlertsContextValue = {
  counts: ReclamoAlertCounts;
  loading: boolean;
  hasNewArrival: boolean;
  dismissNewArrival: () => void;
};

const POLL_INTERVAL_MS = 30_000;

const defaultCounts: ReclamoAlertCounts = {
  recibidos: 0,
  gestion: 0,
  archivados: 0,
  assignedCount: 0,
};

const ReclamoAlertsCtx = createContext<ReclamoAlertsContextValue>({
  counts: defaultCounts,
  loading: true,
  hasNewArrival: false,
  dismissNewArrival: () => {},
});

export function useReclamoAlerts() {
  return useContext(ReclamoAlertsCtx);
}

export function AdminReclamoAlertsProvider({ children }: { children: React.ReactNode }) {
  const user = useAdminUser();
  const pathname = usePathname();
  const canRead = user.permissions.includes('reclamos:read');

  const [counts, setCounts] = useState<ReclamoAlertCounts>(defaultCounts);
  const [loading, setLoading] = useState(canRead);
  const [hasNewArrival, setHasNewArrival] = useState(false);
  const prevRecibidosRef = useRef<number | null>(null);
  const initialFetchDone = useRef(false);

  const dismissNewArrival = useCallback(() => setHasNewArrival(false), []);

  const fetchCounts = useCallback(async () => {
    if (!canRead) return;

    try {
      const res = await fetch('/api/admin/reclamos/counts', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) return;

      const next: ReclamoAlertCounts = {
        recibidos: data.counts?.recibidos ?? 0,
        gestion: data.counts?.gestion ?? 0,
        archivados: data.counts?.archivados ?? 0,
        assignedCount: data.assignedCount ?? 0,
      };

      if (initialFetchDone.current && prevRecibidosRef.current !== null && next.recibidos > prevRecibidosRef.current) {
        setHasNewArrival(true);
      }

      prevRecibidosRef.current = next.recibidos;
      initialFetchDone.current = true;
      setCounts(next);
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    fetchCounts();
    const id = window.setInterval(fetchCounts, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [canRead, fetchCounts]);

  useEffect(() => {
    if (pathname.startsWith('/admin/reclamos')) {
      setHasNewArrival(false);
    }
  }, [pathname]);

  return (
    <ReclamoAlertsCtx.Provider value={{ counts, loading, hasNewArrival, dismissNewArrival }}>
      {children}
      {canRead ? <AdminReclamoNewBanner /> : null}
    </ReclamoAlertsCtx.Provider>
  );
}

function AdminReclamoNewBanner() {
  const { counts, hasNewArrival, dismissNewArrival } = useReclamoAlerts();

  if (!hasNewArrival || counts.recibidos === 0) return null;

  return (
    <div className="fixed inset-x-0 top-14 z-50 flex justify-center px-4 lg:top-4">
      <div
        role="alert"
        className="flex w-full max-w-lg items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>
        <p className="flex-1 text-sm font-semibold text-red-800">
          ¡Nuevo reclamo recibido! Hay {counts.recibidos} sin asignar.
        </p>
        <Link
          href="/admin/reclamos"
          onClick={dismissNewArrival}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Ver ahora
        </Link>
        <button
          type="button"
          onClick={dismissNewArrival}
          className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800"
          aria-label="Cerrar alerta"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function AdminReclamoAlertBell({ className }: { className?: string }) {
  const { counts, hasNewArrival } = useReclamoAlerts();
  const pending = counts.recibidos;

  if (pending === 0) return null;

  return (
    <Link
      href="/admin/reclamos"
      className={cn(
        'relative flex items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600',
        hasNewArrival && 'animate-pulse',
        className
      )}
      title={`${pending} reclamo${pending === 1 ? '' : 's'} sin asignar`}
      aria-label={`${pending} reclamos sin asignar`}
    >
      <Bell className={cn('h-5 w-5', hasNewArrival && 'text-red-600')} />
      <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
        {pending > 99 ? '99+' : pending}
      </span>
      {hasNewArrival ? (
        <span className="absolute -right-0.5 -top-0.5 h-[18px] w-[18px] animate-ping rounded-full bg-red-400 opacity-60" />
      ) : null}
    </Link>
  );
}

export function ReclamoNavBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function ReclamoIconDot({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
    </span>
  );
}
