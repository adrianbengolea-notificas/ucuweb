import Link from 'next/link';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
  children?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = 'Volver',
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-10', className)}>
      {backHref ? (
        <Link href={backHref} className="ucu-btn-ghost mb-5 inline-flex">
          ← {backLabel}
        </Link>
      ) : null}
      {eyebrow ? <p className="ucu-eyebrow mb-2">{eyebrow}</p> : null}
      <h1 className="ucu-title">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-prose font-serif text-base leading-relaxed text-[var(--ink-muted)] md:text-lg">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  href,
  linkLabel = 'Ver todas →',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-8 flex items-end justify-between gap-4 border-b border-[var(--border)] pb-5', className)}>
      <div>
        {eyebrow ? <p className="ucu-section-title mb-1.5">{eyebrow}</p> : null}
        <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] md:text-3xl">
          {title}
        </h2>
      </div>
      {href ? (
        <Link href={href} className="ucu-btn-ghost shrink-0 whitespace-nowrap">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

type ServiceCardProps = {
  title: string;
  description: string;
  href: string;
  accent: 'blue' | 'magenta' | 'green' | 'yellow';
};

const accentStyles = {
  blue: 'bg-ucu-blue/8 group-hover:bg-ucu-blue/12',
  magenta: 'bg-ucu-magenta/8 group-hover:bg-ucu-magenta/12',
  green: 'bg-ucu-green/10 group-hover:bg-ucu-green/15',
  yellow: 'bg-ucu-yellow/12 group-hover:bg-ucu-yellow/18',
};

const accentLabels = {
  blue: 'text-ucu-blue',
  magenta: 'text-ucu-magenta',
  green: 'text-[#5a9a1f]',
  yellow: 'text-[#c48f00]',
};

export function ServiceCard({ title, description, href, accent }: ServiceCardProps) {
  return (
    <Link href={href} className="group ucu-card-interactive ucu-accent-top flex flex-col p-6 md:p-7">
      <div
        className={`mb-4 inline-flex w-fit rounded-md px-2.5 py-1 font-display text-[0.65rem] font-bold uppercase tracking-[0.15em] transition ${accentStyles[accent]} ${accentLabels[accent]}`}
      >
        {title.split(' ').slice(0, 2).join(' ')}
      </div>
      <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-[var(--ink)] group-hover:text-ucu-blue md:text-xl">
        {title}
      </h3>
      <p className="flex-1 font-serif text-sm leading-relaxed text-[var(--ink-muted)]">
        {description}
      </p>
      <span className="mt-5 font-display text-sm font-semibold text-ucu-magenta transition group-hover:text-[#b80063]">
        Conocer más →
      </span>
    </Link>
  );
}
