import { PostList } from '@/components/PostCard';
import { CategorySidebar } from '@/components/SiteHeader';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAllPosts, getCategories } from '@/lib/content';

export default async function PostsPage() {
  const [posts, categories] = await Promise.all([
    getAllPosts(100),
    getCategories(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <PageHeader
        eyebrow="Archivo"
        title="Todas las noticias"
        description={`${posts.length} publicaciones sobre defensa del consumidor.`}
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <PostList posts={posts} />
        <CategorySidebar categories={categories} />
      </div>
    </main>
  );
}
