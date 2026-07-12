import Image from 'next/image';
import type { Metadata } from 'next';
import { Globe, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { groupDelegacionesByProvincia, listDelegacionesPublic } from '@/lib/delegaciones-store';
import { resolveMediaUrl } from '@/lib/media';
import type { DelegacionDocument } from '@/types/delegaciones';

export const metadata: Metadata = {
  title: 'Delegaciones — UCU',
  description:
    'Encontrá la delegación de Usuarios y Consumidores Unidos en tu provincia y contactá a quienes te representan.',
};

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink-muted)] transition hover:border-ucu-blue/30 hover:text-ucu-blue"
    >
      {children}
    </a>
  );
}

function DelegacionCard({ delegacion }: { delegacion: DelegacionDocument }) {
  const hasLinks =
    delegacion.webUrl ||
    delegacion.facebookUrl ||
    delegacion.instagramUrl ||
    delegacion.twitterUrl ||
    delegacion.email ||
    delegacion.telefono;

  return (
    <article className="ucu-card flex flex-col p-5 md:p-6">
      <h3 className="font-display text-lg font-bold text-[var(--ink)]">{delegacion.nombre}</h3>

      <div className="mt-4 flex flex-wrap gap-4">
        {delegacion.delegados.map((delegado) => {
          const foto = resolveMediaUrl(delegado.fotoUrl);
          return (
            <div key={delegado.id} className="flex w-28 flex-col items-center text-center">
              <div className="relative mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)]">
                {foto ? (
                  <Image
                    src={foto}
                    alt={delegado.nombre}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <UserRound className="h-8 w-8 text-[var(--ink-muted)]/40" aria-hidden />
                )}
              </div>
              <p className="text-sm font-medium leading-snug text-[var(--ink)]">{delegado.nombre}</p>
            </div>
          );
        })}
      </div>

      {delegacion.direccion ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-[var(--ink-muted)]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ucu-blue" aria-hidden />
          <span>{delegacion.direccion}</span>
        </p>
      ) : null}

      {hasLinks ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          {delegacion.webUrl ? (
            <SocialLink href={delegacion.webUrl} label="Sitio web">
              <Globe className="h-4 w-4" />
            </SocialLink>
          ) : null}
          {delegacion.facebookUrl ? (
            <SocialLink href={delegacion.facebookUrl} label="Facebook">
              <span className="font-display text-xs font-bold">f</span>
            </SocialLink>
          ) : null}
          {delegacion.instagramUrl ? (
            <SocialLink href={delegacion.instagramUrl} label="Instagram">
              <span className="font-display text-xs font-bold">ig</span>
            </SocialLink>
          ) : null}
          {delegacion.twitterUrl ? (
            <SocialLink href={delegacion.twitterUrl} label="X">
              <span className="font-display text-xs font-bold">x</span>
            </SocialLink>
          ) : null}
          {delegacion.email ? (
            <a
              href={`mailto:${delegacion.email}`}
              aria-label="Email"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink-muted)] transition hover:border-ucu-blue/30 hover:text-ucu-blue"
            >
              <Mail className="h-4 w-4" />
            </a>
          ) : null}
          {delegacion.telefono ? (
            <a
              href={`tel:${delegacion.telefono.replace(/\s/g, '')}`}
              aria-label="Teléfono"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink-muted)] transition hover:border-ucu-blue/30 hover:text-ucu-blue"
            >
              <Phone className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default async function DelegacionesPage() {
  const delegaciones = await listDelegacionesPublic().catch(() => []);
  const grouped = groupDelegacionesByProvincia(delegaciones);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <PageHeader
        title="Delegaciones"
        description="Contactá a las delegaciones de UCU en todo el país."
      />

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center text-[var(--ink-muted)]">
          Todavía no hay delegaciones publicadas.
        </div>
      ) : (
        <div className="space-y-12">
          {grouped.map((group) => (
            <section key={group.provincia}>
              <h2 className="mb-5 font-display text-2xl font-bold tracking-tight text-[var(--ink)] md:text-3xl">
                {group.provincia}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.delegaciones.map((delegacion) => (
                  <DelegacionCard key={delegacion.slug} delegacion={delegacion} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
