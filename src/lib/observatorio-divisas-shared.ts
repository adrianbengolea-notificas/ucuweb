import type { DivisaOption } from '@/types/observatorio';

/** Códigos usados para unidad de montos del fallo (sobre todo daño punitivo). */
export const DIVISA_PESOS_CODIGO = 'ARS';
export const DIVISA_CANASTA_CODIGO = 'CBA';

/** Id histórico de peso argentino en el catálogo migrado. */
export const DIVISA_PESOS_ID = 7;

/** Id fijo para canasta básica (nuevo; no colisiona con USD 146 / SMV 162). */
export const DIVISA_CANASTA_ID = 163;

export const DIVISA_CANASTA_BASICA: DivisaOption = {
  id: DIVISA_CANASTA_ID,
  codigo: DIVISA_CANASTA_CODIGO,
  nombre: 'Canasta básica',
  pais: 'Argentina',
};

export function isCanastaBasicaDivisa(
  divisa: { codigo?: string | null; nombre?: string | null } | null | undefined
): boolean {
  if (!divisa) return false;
  const code = (divisa.codigo ?? '').trim().toUpperCase();
  const name = (divisa.nombre ?? '').trim().toLowerCase();
  return (
    code === DIVISA_CANASTA_CODIGO ||
    code === 'CBT' ||
    code === 'CB' ||
    name.includes('canasta')
  );
}

export function isPesosDivisa(
  divisa: { codigo?: string | null; nombre?: string | null } | null | undefined
): boolean {
  if (!divisa) return true;
  const code = (divisa.codigo ?? '').trim().toUpperCase();
  const name = (divisa.nombre ?? '').trim().toLowerCase();
  return code === DIVISA_PESOS_CODIGO || name.includes('peso');
}

export function resolveDivisaCodigoFromText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

  if (
    normalized.includes('canasta') ||
    normalized === 'cba' ||
    normalized === 'cbt' ||
    normalized === 'cb'
  ) {
    return DIVISA_CANASTA_CODIGO;
  }
  if (
    normalized.includes('salario minimo') ||
    normalized.includes('smvm') ||
    normalized === 'smv'
  ) {
    return 'SMV';
  }
  if (normalized.includes('dolar') || normalized === 'usd' || normalized.includes('u$s')) {
    return 'USD';
  }
  if (normalized.includes('peso') || normalized === 'ars' || normalized.includes('$')) {
    return DIVISA_PESOS_CODIGO;
  }
  return value.trim().toUpperCase();
}

export function findDivisaIdByCodigo(
  divisas: { id: number; codigo: string; nombre?: string }[],
  codigo: string
): string {
  const target = codigo.toUpperCase();
  const found = divisas.find((item) => item.codigo.toUpperCase() === target);
  if (found) return String(found.id);
  if (target === DIVISA_PESOS_CODIGO) return String(DIVISA_PESOS_ID);
  if (target === DIVISA_CANASTA_CODIGO) return String(DIVISA_CANASTA_ID);
  return '';
}
