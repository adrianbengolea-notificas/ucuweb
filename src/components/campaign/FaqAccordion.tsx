'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FaqSection } from '@/lib/campaign-planes-ahorro';
import { cn } from '@/lib/utils';

export function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-[var(--ink)] md:text-2xl">
            {section.title}
          </h2>
          <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
            {section.items.map((item) => {
              const key = `${section.title}-${item.question}`;
              const open = openKey === key;

              return (
                <div key={key}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--surface-muted)]"
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : key)}
                  >
                    <span className="font-display text-sm font-semibold leading-snug text-[var(--ink)] md:text-base">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        'mt-0.5 h-5 w-5 shrink-0 text-ucu-blue transition-transform duration-200',
                        open && 'rotate-180',
                      )}
                      strokeWidth={2}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-200 ease-out',
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-4 font-serif text-sm leading-relaxed text-[var(--ink-muted)]">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
