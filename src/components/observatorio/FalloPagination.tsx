import Link from 'next/link';
import { buildSearchQuery } from '@/lib/observatorio';
import type { FalloSearchParams } from '@/types/observatorio';

export function FalloPagination({
  currentPage,
  totalPages,
  params,
}: {
  currentPage: number;
  totalPages: number;
  params: FalloSearchParams;
}) {
  if (totalPages <= 1) return null;

  const pages = buildPageList(currentPage, totalPages);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginación">
      {currentPage > 1 ? (
        <PaginationLink page={currentPage - 1} params={params}>
          ← Anterior
        </PaginationLink>
      ) : null}

      {pages.map((page, index) =>
        page === '…' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
            …
          </span>
        ) : (
          <PaginationLink
            key={page}
            page={page}
            params={params}
            active={page === currentPage}
          >
            {page}
          </PaginationLink>
        )
      )}

      {currentPage < totalPages ? (
        <PaginationLink page={currentPage + 1} params={params}>
          Siguiente →
        </PaginationLink>
      ) : null}
    </nav>
  );
}

function PaginationLink({
  page,
  params,
  active,
  children,
}: {
  page: number;
  params: FalloSearchParams;
  active?: boolean;
  children: React.ReactNode;
}) {
  const href = `/observatorio/buscar${buildSearchQuery({ ...params, page })}`;

  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[#1a5fb4] text-white'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1a5fb4]/30 hover:text-[#1a5fb4]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}

function buildPageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: Array<number | '…'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('…');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push('…');
  pages.push(total);

  return pages;
}
