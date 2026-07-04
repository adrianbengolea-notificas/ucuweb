import type { Metadata } from 'next';
import Link from 'next/link';
import { ReclamoForm } from '@/components/reclamos/ReclamoForm';

export const metadata: Metadata = {
  title: 'Nuevo reclamo — Usuarios Protegidos UCU',
  description: 'Formulario para iniciar un reclamo de consumo ante UCU.',
};

export default function NuevoReclamoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <Link href="/reclamos" className="text-sm font-semibold text-[#1a5fb4] hover:underline">
          ← Volver a reclamos
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Realizá tu reclamo</h1>
        <p className="mt-2 text-slate-600">
          Completá todos los campos. Al finalizar recibirás un número para hacer seguimiento.
        </p>
      </div>
      <ReclamoForm />
    </main>
  );
}
