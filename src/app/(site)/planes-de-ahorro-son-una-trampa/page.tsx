import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CampaignLanding } from '@/components/campaign/CampaignLanding';
import { getPageBySlug, getPostsByCategory } from '@/lib/content';
import { decodeHtmlEntities } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/media';
import { extractBackgroundImages } from '@/lib/wordpress-html';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug('planes-de-ahorro-son-una-trampa').catch(() => null);
  const title = page ? decodeHtmlEntities(page.title) : 'Planes de ahorro son una trampa';

  return {
    title: `${title} — UCU`,
    description:
      'Campaña nacional de UCU por la reforma integral del sistema de planes de ahorro automotor. Exigencias, recursos y asesoramiento para ahorristas.',
  };
}

export default async function CampanaPlanesAhorroPage() {
  const [page, relatedPosts] = await Promise.all([
    getPageBySlug('planes-de-ahorro-son-una-trampa').catch(() => null),
    getPostsByCategory('planes-de-ahorros', 6).catch(() => []),
  ]);

  if (!page) notFound();

  const bgImages = extractBackgroundImages(page.content);
  const heroImageUrl = resolveMediaUrl(bgImages[0] ?? null);

  return (
    <main>
      <CampaignLanding heroImageUrl={heroImageUrl} relatedPosts={relatedPosts} />
    </main>
  );
}
