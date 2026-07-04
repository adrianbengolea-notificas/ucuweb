import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageBySlug } from '@/lib/content';
import { decodeHtmlEntities } from '@/lib/format';
import { rewriteContentMediaUrls } from '@/lib/media';

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug).catch(() => null);
  if (!page) notFound();
  const title = decodeHtmlEntities(page.title);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="mb-6 inline-block text-sm text-blue-700 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mb-8 text-4xl font-bold">{title}</h1>
      <div
        className="prose-ucu"
        dangerouslySetInnerHTML={{ __html: rewriteContentMediaUrls(page.content) }}
      />
    </main>
  );
}
