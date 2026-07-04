const MOJIBAKE_PATTERN = /(?:Ã.|ã.|â€.|ï¿½)/;

const MOJIBAKE_REPLACEMENTS: [string, string][] = [
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ãº', 'ú'],
  ['Ã±', 'ñ'],
  ['Ã¼', 'ü'],
  ['Ã\x81', 'Á'],
  ['Ã‰', 'É'],
  ['Ã\x8d', 'Í'],
  ['Ã\x93', 'Ó'],
  ['Ã\x9a', 'Ú'],
  ['Ã\x91', 'Ñ'],
  ['ã¡', 'á'],
  ['ã©', 'é'],
  ['ã­', 'í'],
  ['ã³', 'ó'],
  ['ãº', 'ú'],
  ['ã±', 'ñ'],
  ['â€™', "'"],
  ['â€œ', '"'],
  ['â€\x9d', '"'],
  ['â€"', '—'],
  ['â€"', '–'],
];

export function hasMojibake(text: string): boolean {
  return MOJIBAKE_PATTERN.test(text);
}

function fixByReplacementMap(text: string): string {
  let out = text;
  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    out = out.split(bad).join(good);
  }
  return out;
}

/** Corrige texto UTF-8 mal interpretado como Latin-1 (mojibake). */
export function fixLatin1Mojibake(text: string): string {
  if (!text || typeof text !== 'string') return text;
  if (!hasMojibake(text)) return text;

  const reinterpreted = Buffer.from(text, 'latin1').toString('utf8');
  if (!reinterpreted.includes('\uFFFD') && reinterpreted !== text) {
    return fixLatin1Mojibake(reinterpreted);
  }

  return fixByReplacementMap(text);
}

export function fixEncodingDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return fixLatin1Mojibake(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => fixEncodingDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = fixEncodingDeep(nested);
    }
    return out as T;
  }
  return value;
}
