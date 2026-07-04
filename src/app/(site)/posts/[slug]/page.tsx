import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPostBySlug } from '@/lib/content';
import { decodeHtmlEntities } from '@/lib/format';
import { resolveMediaUrl, rewriteContentMediaUrls } from '@/lib/media';
import { CommentSection } from '@/components/comments/CommentSection';

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post) notFound();
  const title = decodeHtmlEntities(post.title);
  const imageUrl = resolveMediaUrl(post.featuredImage?.url);
  const contentHtml = rewriteContentMediaUrls(post.content);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <Link href="/posts" className="ucu-btn-ghost mb-8 inline-flex">
        ← Volver a notas
      </Link>

      <article>
        <div className="mb-5 flex flex-wrap gap-2">
          {post.categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categoria/${category.slug}`}
              className="ucu-tag"
            >
              {category.name}
            </Link>
          ))}
        </div>

        <h1 className="ucu-title mb-5">{title}</h1>

        <div className="mb-8 flex flex-wrap gap-3 font-display text-sm text-[var(--ink-faint)]">
          <span>{post.author.name}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.publishedAt}>
            {format(new Date(post.publishedAt), "d 'de' MMMM yyyy", { locale: es })}
          </time>
        </div>

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={post.featuredImage?.alt || title}
            className="mb-10 w-full rounded-lg object-cover"
          />
        ) : null}

        <div className="prose-ucu" dangerouslySetInnerHTML={{ __html: contentHtml }} />

        {post.tags.length ? (
          <div className="mt-12 border-t border-[var(--border)] pt-8">
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-[var(--ink-faint)]">
              Etiquetas
            </h2>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag.slug}
                  className="rounded-md bg-[var(--surface-muted)] px-3 py-1 font-display text-xs text-[var(--ink-muted)]"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <CommentSection postSlug={slug} />
    </main>
  );
}
