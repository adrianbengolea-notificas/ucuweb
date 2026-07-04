import { notFound } from 'next/navigation';
import { FalloEditor } from '@/components/admin/FalloEditor';
import { getStoredFalloById } from '@/lib/observatorio-store';

export default async function EditarFalloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const nroExpediente = Number(id);
  if (!Number.isFinite(nroExpediente)) notFound();

  const fallo = await getStoredFalloById(nroExpediente);
  if (!fallo) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editar fallo {nroExpediente}</h1>
        <p className="mt-1 text-slate-500">Actualizá los datos del expediente.</p>
      </div>
      <FalloEditor mode="edit" initialId={nroExpediente} initialFallo={fallo} />
    </div>
  );
}
