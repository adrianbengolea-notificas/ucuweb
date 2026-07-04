import { FalloEditor } from '@/components/admin/FalloEditor';

export default function NuevoFalloPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Nuevo fallo</h1>
        <p className="mt-1 text-slate-500">
          Cargá un fallo al observatorio. Podés subir el PDF y la IA completa el formulario.
        </p>
      </div>
      <FalloEditor mode="create" />
    </div>
  );
}
