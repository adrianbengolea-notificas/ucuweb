export const SEARCH_STOPWORDS = new Set([
  'reclamo',
  'reclamos',
  'denuncia',
  'denuncias',
  'contra',
  'buscar',
  'busca',
  'buscame',
  'busqueda',
  'oficio',
  'oficios',
  'contestacion',
  'todas',
  'todos',
  'sobre',
  'empresa',
  'empresas',
  'caso',
  'casos',
  'resumen',
  'resumir',
  'resumem',
  'explica',
  'explicar',
  'haceme',
  'hacer',
  'tenemos',
]);

/** Forma societaria / rubro genérico. No identifica a una administradora. */
export const EMPRESA_GENERIC_TOKENS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'e',
  'o',
  'u',
  'sa',
  'sau',
  'srl',
  'sas',
  'soc',
  'sociedad',
  'anonima',
  'anonimo',
  'para',
  'con',
  'por',
  'sus',
  'una',
  'un',
  'ahorro',
  'ahorros',
  'plan',
  'planes',
  'fines',
  'determinados',
  'determinada',
  'determinado',
  'administradora',
  'administracion',
  'cooperativa',
  'grupo',
  'cia',
]);

const EMPRESA_ALIASES: Record<string, string[]> = {
  fca: ['fiat'],
  fiat: ['fca'],
};

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function collapseAlnum(value: string): string {
  return value.replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function maxEditDistance(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

export function tokenizeSearch(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const NON_BRAND_TOKENS = new Set([
  ...SEARCH_STOPWORDS,
  'mora',
  'quita',
  'incumplimiento',
  'entrega',
  'debito',
  'cuota',
  'cuotas',
  'vicio',
  'garantia',
  'deuda',
  'intereses',
  'capital',
  'suspension',
  'actualizacion',
  'indice',
  'cesacion',
  'desistimiento',
  'archivados',
  'archivado',
  'activos',
  'tramite',
]);

export function distinctiveEmpresaTokens(query: string): string[] {
  return tokenizeSearch(query).filter(
    (token) =>
      token.length >= 2 && !EMPRESA_GENERIC_TOKENS.has(token) && !SEARCH_STOPWORDS.has(token)
  );
}

/** Marca extraída de una consigna libre, sin motivos de reclamo. */
export function empresaBrandsFromText(text: string): string[] {
  return distinctiveEmpresaTokens(text).filter((token) => !NON_BRAND_TOKENS.has(token));
}

function tokenMatchesEmpresa(token: string, query: string): boolean {
  if (token.length < 3 && query.length < 3) {
    return token === query;
  }
  if (token.length < 2) return false;
  if (token.includes(query) || query.includes(token)) {
    if (token.includes(query)) return query.length >= 2;
    return token.length >= Math.min(4, query.length);
  }

  const collapsedToken = collapseAlnum(token);
  const collapsedQuery = collapseAlnum(query);
  if (collapsedToken.includes(collapsedQuery) || collapsedQuery.includes(collapsedToken)) {
    return Math.min(collapsedToken.length, collapsedQuery.length) >= 3;
  }

  if (Math.abs(token.length - query.length) > maxEditDistance(query.length)) return false;
  return levenshtein(token, query) <= maxEditDistance(query.length);
}

function tokenInEmpresa(empresaSearch: string, empresaTokens: string[], queryToken: string): boolean {
  if (empresaSearch.includes(queryToken) || empresaTokens.some((token) => tokenMatchesEmpresa(token, queryToken))) {
    return true;
  }
  const aliases = EMPRESA_ALIASES[queryToken] ?? [];
  return aliases.some(
    (alias) =>
      empresaSearch.includes(alias) || empresaTokens.some((token) => tokenMatchesEmpresa(token, alias))
  );
}

/**
 * "FCA de ahorro para fines" debe matchear solo FCA, no Chevrolet Plan ni Círculo.
 * Los tokens genéricos del rubro (ahorro, plan, fines, sa…) no alcanzan para identificar empresa.
 */
export function matchesEmpresaQuery(empresaSearch: string, query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (!normalized) return true;
  if (empresaSearch.includes(normalized)) return true;

  const collapsedSearch = collapseAlnum(empresaSearch);
  const collapsedQuery = collapseAlnum(normalized);
  const distinctive = distinctiveEmpresaTokens(normalized);

  if (
    distinctive.length === 0 &&
    collapsedQuery.length >= 3 &&
    collapsedSearch.includes(collapsedQuery)
  ) {
    return true;
  }

  const empresaTokens = tokenizeSearch(empresaSearch);
  const tokensToRequire =
    distinctive.length > 0
      ? distinctive
      : tokenizeSearch(normalized).filter((token) => token.length >= 3 && !EMPRESA_GENERIC_TOKENS.has(token));

  if (tokensToRequire.length > 0) {
    return tokensToRequire.every((qt) => tokenInEmpresa(empresaSearch, empresaTokens, qt));
  }

  const genericTokens = tokenizeSearch(normalized).filter(
    (token) => token.length >= 3 && EMPRESA_GENERIC_TOKENS.has(token)
  );
  if (genericTokens.length === 0) return false;
  return genericTokens.every((qt) => tokenInEmpresa(empresaSearch, empresaTokens, qt));
}

export function sanitizeSearchKeywords(keywords: string[] | undefined, empresaQuery?: string): string[] {
  if (!keywords?.length) return [];

  const eq = empresaQuery ? normalizeSearchText(empresaQuery) : '';
  const eqCollapsed = eq ? collapseAlnum(eq) : '';
  const empresaTokens = new Set(eq ? tokenizeSearch(eq) : []);

  return keywords.filter((kw) => {
    const n = normalizeSearchText(kw);
    if (!n || n.length < 3) return false;
    if (SEARCH_STOPWORDS.has(n) || EMPRESA_GENERIC_TOKENS.has(n)) return false;
    if (n.split(/[^a-z0-9]+/).every((token) => !token || EMPRESA_GENERIC_TOKENS.has(token) || SEARCH_STOPWORDS.has(token))) {
      return false;
    }
    if (!eq) return true;
    if (n === eq) return false;
    if (eq.includes(n) || n.includes(eq)) return false;
    if (empresaTokens.has(n)) return false;
    const collapsed = collapseAlnum(n);
    if (eqCollapsed && (eqCollapsed.includes(collapsed) || collapsed.includes(eqCollapsed))) {
      return false;
    }
    return true;
  });
}

export function splitKeywordInput(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
