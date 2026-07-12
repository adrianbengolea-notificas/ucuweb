import { DelegacionEditor } from '@/components/admin/DelegacionEditor';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditarDelegacionPage({ params }: PageProps) {
  const { slug } = await params;
  return <DelegacionEditor mode="edit" initialSlug={slug} />;
}
