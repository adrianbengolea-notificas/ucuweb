import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { getGeminiApiKey, parseReclamoSearchInstruction } from '@/lib/gemini';
import { empresaBrandsFromText, splitKeywordInput } from '@/lib/reclamos-search-match';
import {
  getSearchIndexMeta,
  mergeParsedFilters,
  searchReclamosIndex,
} from '@/lib/reclamos-search-index';
import type { ReclamoSearchFilters } from '@/types/reclamos-search';

function readNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function readManualFilters(body: Record<string, unknown>): Partial<ReclamoSearchFilters> {
  const manual: Partial<ReclamoSearchFilters> = {};

  if (typeof body.empresaId === 'number' && body.empresaId > 0) {
    manual.empresaId = body.empresaId;
  }
  if (typeof body.empresaQuery === 'string' && body.empresaQuery.trim()) {
    manual.empresaQuery = body.empresaQuery.trim();
  }
  if (typeof body.dateFrom === 'string' && body.dateFrom.trim()) {
    manual.dateFrom = body.dateFrom.trim();
  }
  if (typeof body.dateTo === 'string' && body.dateTo.trim()) {
    manual.dateTo = body.dateTo.trim();
  }
  if (body.idGrupoEstado === 1 || body.idGrupoEstado === 2 || body.idGrupoEstado === 3) {
    manual.idGrupoEstado = body.idGrupoEstado;
  }
  const causaIds = readNumberArray(body.causaIds);
  if (causaIds.length) manual.causaIds = causaIds;

  const keywords =
    typeof body.keywords === 'string'
      ? splitKeywordInput(body.keywords)
      : Array.isArray(body.keywords)
        ? body.keywords.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
  if (keywords.length) manual.keywords = keywords;

  const causaKeywords =
    typeof body.causaKeywords === 'string'
      ? splitKeywordInput(body.causaKeywords)
      : Array.isArray(body.causaKeywords)
        ? body.causaKeywords.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
  if (causaKeywords.length) manual.causaKeywords = causaKeywords;

  return manual;
}

function hasManualCriteria(manual: Partial<ReclamoSearchFilters>): boolean {
  return Boolean(
    manual.empresaId ||
      manual.empresaQuery ||
      manual.dateFrom ||
      manual.dateTo ||
      manual.idGrupoEstado ||
      manual.causaIds?.length ||
      manual.keywords?.length ||
      manual.causaKeywords?.length
  );
}

export async function GET(request: NextRequest) {
  if (!requireAdminPermission(request, 'reclamos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const meta = await getSearchIndexMeta();
    return NextResponse.json({
      indexedAt: meta?.indexedAt ?? null,
      count: meta?.count ?? 0,
      geminiConfigured: Boolean(getGeminiApiKey()),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo leer el índice' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdminPermission(request, 'reclamos:read')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const manual = readManualFilters(body);

  if (!instruction && !hasManualCriteria(manual)) {
    return NextResponse.json(
      { error: 'Escribí una instrucción o usá al menos un filtro (empresa, causa, fecha o estado).' },
      { status: 400 }
    );
  }

  try {
    const meta = await getSearchIndexMeta();
    if (!meta?.count) {
      return NextResponse.json(
        {
          error:
            'El índice de búsqueda está vacío. Ejecutá npm run build:reclamos-index en el servidor.',
        },
        { status: 503 }
      );
    }

    let filters: ReclamoSearchFilters = { ...manual };
    let interpretacion = 'Búsqueda con filtros manuales';

    if (instruction) {
      if (!getGeminiApiKey()) {
        return NextResponse.json(
          {
            error:
              'La instrucción con IA no está disponible: falta el secreto GEMINI_API_KEY en el servidor. Podés buscar solo con el filtro de empresa.',
          },
          { status: 503 }
        );
      }
      const parsed = await parseReclamoSearchInstruction(instruction);
      interpretacion = parsed.interpretacion;
      filters = await mergeParsedFilters(parsed.filters, manual);
      if (!empresaBrandsFromText(filters.empresaQuery ?? '').length) {
        const brands = empresaBrandsFromText(instruction);
        if (brands.length) filters.empresaQuery = brands.join(' ');
      }
    } else {
      filters = await mergeParsedFilters({}, manual);
    }

    const result = await searchReclamosIndex(filters, interpretacion);
    const hits = Array.isArray(result.hits) ? result.hits : [];

    return NextResponse.json({
      interpretacion,
      hits: hits.slice(0, 500),
      stats: result.stats,
      filtersApplied: result.filtersApplied,
      truncated: hits.length > 500,
    });
  } catch (error) {
    console.error(error);
    const raw = error instanceof Error ? error.message : '';
    const isInternal =
      !raw ||
      /cannot read propert/i.test(raw) ||
      /is not (a )?function/i.test(raw) ||
      /unexpected token|not valid json/i.test(raw);
    const message = isInternal
      ? 'No se pudo completar la búsqueda. Probá de nuevo o usá el filtro de empresa.'
      : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
