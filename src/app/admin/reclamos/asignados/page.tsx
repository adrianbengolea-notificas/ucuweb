import { AdminReclamosList } from '@/components/admin/AdminReclamosList';

export default function AdminReclamosAsignadosPage() {
  return (
    <AdminReclamosList
      mode="assigned"
      title="Asignados"
      description="Casos donde sos el responsable asignado."
      emptyTitle="No tenés reclamos asignados"
      emptyDescription="Cuando te asignen un caso, aparecerá acá. Podés ver todos los demás en Reclamos."
    />
  );
}
