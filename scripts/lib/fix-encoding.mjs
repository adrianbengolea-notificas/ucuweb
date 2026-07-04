/** Mantener en sync con src/lib/fix-encoding.ts */

const MOJIBAKE_PATTERN = /(?:Ã.|ã.|â€.|ï¿½)/;

const MOJIBAKE_REPLACEMENTS = [
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

export function hasMojibake(text) {
  return MOJIBAKE_PATTERN.test(text);
}

function fixByReplacementMap(text) {
  let out = text;
  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    out = out.split(bad).join(good);
  }
  return out;
}

export function fixLatin1Mojibake(text) {
  if (!text || typeof text !== 'string') return text;
  if (!hasMojibake(text)) return text;

  const reinterpreted = Buffer.from(text, 'latin1').toString('utf8');
  if (!reinterpreted.includes('\uFFFD') && reinterpreted !== text) {
    return fixLatin1Mojibake(reinterpreted);
  }

  return fixByReplacementMap(text);
}

export function fixEncodingDeep(value) {
  if (typeof value === 'string') return fixLatin1Mojibake(value);
  if (Array.isArray(value)) return value.map((item) => fixEncodingDeep(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = fixEncodingDeep(nested);
    }
    return out;
  }
  return value;
}

export function collectMojibakeStrings(value, path = '', hits = []) {
  if (typeof value === 'string') {
    if (hasMojibake(value)) hits.push({ path, before: value, after: fixLatin1Mojibake(value) });
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectMojibakeStrings(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectMojibakeStrings(nested, path ? `${path}.${key}` : key, hits);
    }
  }
  return hits;
}
