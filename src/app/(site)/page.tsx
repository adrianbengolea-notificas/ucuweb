import Link from 'next/link';
import { PostList } from '@/components/PostCard';
import { CampaignBanner } from '@/components/campaign/CampaignBanner';
import { CategorySidebar, HeroSection } from '@/components/SiteHeader';
import { SectionHeader, ServiceCard } from '@/components/ui/PageHeader';
import { getCategories, getRecentPosts } from '@/lib/content';
import { isFirebaseConfigured } from '@/lib/utils';

export default async function HomePage() {
  if (!isFirebaseConfigured()) {
    return (
      <>
        <HeroSection />
        <CampaignBanner />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="ucu-title text-ucu-blue">UCU — Nuevo sitio</h1>
          <p className="mt-4 font-serif text-[var(--ink-muted)]">
            Completá <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-sm">.env.local</code> y ejecutá la migración.
          </p>
        </main>
      </>
    );
  }

  const [posts, categories] = await Promise.all([
    getRecentPosts(12),
    getCategories(),
  ]);

  return (
    <>
      <HeroSection />
      <CampaignBanner />

      <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <section className="grid gap-10 lg:grid-cols-[1fr_280px]">
          <div>
            <SectionHeader
              eyebrow="Noticias"
              title="Últimas publicaciones"
              href="/posts"
            />
            <PostList posts={posts} />
          </div>
          <CategorySidebar categories={categories} />
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="Recursos"
            title="Áreas de acción"
            className="mb-8"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceCard
              title="Alertas de fraude"
              accent="magenta"
              description="Información sobre estafas, cobranzas abusivas y prácticas ilegales que afectan a consumidores."
              href="/categoria/alertas-de-fraude"
            />
            <ServiceCard
              title="Reclamos de consumo"
              accent="green"
              description="Realizá tu reclamo online y seguí su estado con Usuarios Protegidos hasta la conciliación."
              href="/reclamos"
            />
            <ServiceCard
              title="Planes de ahorro"
              accent="blue"
              description="Campaña nacional, recursos y noticias sobre uno de los temas más denunciados por consumidores."
              href="/planes-de-ahorro-son-una-trampa"
            />
          </div>
        </section>
      </main>
    </>
  );
}
