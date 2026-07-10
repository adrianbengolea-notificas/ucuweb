import { getTopColaboradores } from '@/lib/colaboradores-store';
import type { PublicColaborador } from '@/types/colaboradores';
import { ColaboradorAuthButton } from '@/components/observatorio/ColaboradorAuthButton';

function RankingRow({ colaborador, rank }: { colaborador: PublicColaborador; rank: number }) {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ucu-blue font-display text-sm font-bold text-white">
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {colaborador.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={colaborador.photoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-[var(--border)] object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] font-display text-sm font-bold text-ucu-blue">
            {colaborador.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-[var(--ink)]">{colaborador.name}</p>
          <p className="font-display text-xs text-[var(--ink-muted)]">
            {colaborador.fallosCount} fallos · {colaborador.commentsCount} comentarios
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-display text-lg font-bold text-ucu-magenta">{colaborador.score}</p>
        <p className="font-display text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">puntos</p>
      </div>
    </li>
  );
}

export async function ColaboradoresPanel() {
  let colaboradores: PublicColaborador[] = [];
  try {
    colaboradores = await getTopColaboradores(10);
  } catch {
    colaboradores = [];
  }

  return (
    <section className="ucu-card mt-12 p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-ucu-green">
            Comunidad
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--ink)] md:text-3xl">
            Colaboradores
          </h2>
          <p className="mt-3 font-serif text-base leading-relaxed text-[var(--ink-muted)]">
            Cualquiera puede cargar fallos. Si te registrás con Google, podés comentarlos y sumar
            puntos en el ranking (+10 por fallo, +3 por comentario).
          </p>
          <div className="mt-6">
            <ColaboradorAuthButton />
          </div>
        </div>

        <div className="min-w-0 flex-1 lg:max-w-md">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-[var(--ink-faint)]">
            Ranking
          </h3>
          {colaboradores.length ? (
            <ol className="space-y-3">
              {colaboradores.map((colaborador, index) => (
                <RankingRow key={colaborador.uid} colaborador={colaborador} rank={index + 1} />
              ))}
            </ol>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] p-6 text-center">
              <p className="font-display text-sm font-semibold text-[var(--ink)]">
                Todavía no hay colaboradores
              </p>
              <p className="mt-1 font-serif text-sm text-[var(--ink-muted)]">
                Sé el primero en registrarte.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
