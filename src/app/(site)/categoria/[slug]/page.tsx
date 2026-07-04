import { notFound } from 'next/navigation';
import { PostList } from '@/components/PostCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCategory, getPostsByCategory } from '@/lib/content';
import { decodeHtmlEntities } from '@/lib/format';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, posts] = await Promise.all([
    getCategory(slug).catch(() => null),
    getPostsByCategory(slug, 100).catch(() => []),
  ]);

  if (!category) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <PageHeader
        title={decodeHtmlEntities(category.name)}
        description={category.description || `${posts.length} publicaciones en esta categoría.`}
      />
      <PostList posts={posts} />
    </main>
  );
}
