import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { decodeHtmlEntities, stripHtml } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/media';
import type { ContentDocument } from '@/types/content';

function excerptText(post: ContentDocument): string {
  const raw = post.excerpt || post.content;
  return decodeHtmlEntities(stripHtml(raw)).slice(0, 180);
}

export function PostCard({ post, featured = false }: { post: ContentDocument; featured?: boolean }) {
  const title = decodeHtmlEntities(post.title);
  const imageUrl = resolveMediaUrl(post.featuredImage?.url);

  return (
    <article
      className={`group ucu-card-interactive ucu-accent-top overflow-hidden ${
        featured ? 'md:col-span-2 md:grid md:grid-cols-2' : ''
      }`}
    >
      {imageUrl ? (
        <Link
          href={`/posts/${post.slug}`}
          className={`relative block overflow-hidden bg-[var(--surface-muted)] ${featured ? 'md:h-full' : ''}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={post.featuredImage?.alt || title}
            className={`w-full object-cover transition duration-500 ease-out group-hover:scale-[1.02] ${
              featured ? 'h-56 md:h-full md:min-h-[300px]' : 'h-48'
            }`}
          />
        </Link>
      ) : (
        <div
          className={`relative bg-[var(--surface-muted)] ${
            featured ? 'h-56 md:h-full' : 'h-48'
          }`}
        >
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--ink-faint)]">
              UCU
            </span>
          </div>
        </div>
      )}

      <div className="flex h-full flex-col p-5 md:p-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {post.categories.slice(0, 2).map((category) => (
            <Link
              key={category.slug}
              href={`/categoria/${category.slug}`}
              className="ucu-tag transition hover:bg-ucu-blue/10"
            >
              {category.name}
            </Link>
          ))}
        </div>

        <h2 className={`mb-3 font-display font-bold tracking-tight text-[var(--ink)] ${featured ? 'text-2xl' : 'text-lg'}`}>
          <Link href={`/posts/${post.slug}`} className="transition hover:text-ucu-blue">
            {title}
          </Link>
        </h2>

        <p className="mb-4 line-clamp-3 flex-1 font-serif text-sm leading-relaxed text-[var(--ink-muted)]">
          {excerptText(post)}
          {excerptText(post).length >= 180 ? '…' : ''}
        </p>

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 font-display text-xs text-[var(--ink-faint)]">
          <span>{post.author.name}</span>
          <time dateTime={post.publishedAt}>
            {format(new Date(post.publishedAt), "d MMM yyyy", { locale: es })}
          </time>
        </div>

        <Link
          href={`/posts/${post.slug}`}
          className="mt-4 inline-flex font-display text-sm font-semibold text-ucu-magenta transition hover:text-[#b80063]"
        >
          Leer más →
        </Link>
      </div>
    </article>
  );
}

export function PostList({ posts }: { posts: ContentDocument[] }) {
  if (!posts.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] p-12 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">No hay publicaciones todavía</p>
        <p className="mt-2 font-serif text-sm text-[var(--ink-muted)]">
          Si acabás de migrar, refrescá la página en unos segundos.
        </p>
      </div>
    );
  }

  const [featured, ...rest] = posts;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <PostCard post={featured} featured />
        {rest.slice(0, 2).map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
      {rest.length > 2 ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {rest.slice(2).map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
