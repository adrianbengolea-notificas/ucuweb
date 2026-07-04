import { PostEditor } from '@/components/admin/PostEditor';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PostEditor mode="edit" initialSlug={slug} />;
}
