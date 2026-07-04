import { AdminReclamosList } from '@/components/admin/AdminReclamosList';

export default function AdminReclamosPage() {
  return (
    <AdminReclamosList
      mode="all"
      title="Reclamos"
      description="Bandeja general de casos — todos los reclamos del sistema."
      emptyTitle="No hay reclamos en esta bandeja"
      emptyDescription="Los nuevos reclamos del formulario público aparecerán en Recibidos."
    />
  );
}
