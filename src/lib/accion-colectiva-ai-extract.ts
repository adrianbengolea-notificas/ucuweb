import 'server-only';

import { extractExpedienteTimelineFromPdf } from '@/lib/gemini';
import type { ExpedienteExtraccionResult, ExpedientePasoExtraido } from '@/types/acciones-colectivas';

function normalizeFechaToIso(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00.000Z`;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`;
  }

  const yearMonth = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (yearMonth) {
    const [, m, y] = yearMonth;
    return `${y}-${m.padStart(2, '0')}-01T12:00:00.000Z`;
  }

  return null;
}

function normalizePaso(
  paso: {
    fecha: string | null;
    titulo: string | null;
    descripcion: string | null;
    importancia: 'alta' | 'media' | 'baja' | null;
  },
  index: number
): { paso: ExpedientePasoExtraido | null; warning?: string } {
  const descripcion = String(paso.descripcion ?? '').trim();
  if (!descripcion) {
    return { paso: null, warning: `Paso ${index + 1}: sin descripción, omitido` };
  }

  const fechaIso = normalizeFechaToIso(paso.fecha);
  if (!fechaIso) {
    return {
      paso: null,
      warning: `Paso ${index + 1}: fecha no reconocida (${paso.fecha ?? 'vacía'})`,
    };
  }

  const importancia =
    paso.importancia === 'alta' || paso.importancia === 'media' || paso.importancia === 'baja'
      ? paso.importancia
      : 'media';

  if (importancia === 'baja') {
    return { paso: null };
  }

  const titulo = String(paso.titulo ?? '').trim() || descripcion.slice(0, 80);

  return {
    paso: {
      fecha: fechaIso,
      titulo,
      descripcion,
      importancia,
    },
  };
}

export async function extractExpedienteTimeline(
  pdfBuffer: Buffer,
  context?: { tituloAccion?: string }
): Promise<ExpedienteExtraccionResult> {
  const pdfBase64 = pdfBuffer.toString('base64');
  const raw = await extractExpedienteTimelineFromPdf(pdfBase64, context);

  const warnings = [...raw.advertencias];
  const pasos: ExpedientePasoExtraido[] = [];

  for (const [index, item] of raw.pasos.entries()) {
    const { paso, warning } = normalizePaso(item, index);
    if (warning) warnings.push(warning);
    if (paso) pasos.push(paso);
  }

  pasos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  if (pasos.length === 0) {
    warnings.push(
      'No se detectaron pasos importables. Revisá el PDF o cargá las novedades manualmente.'
    );
  }

  return {
    tituloSugerido: raw.tituloSugerido,
    resumenSugerido: raw.resumenSugerido,
    pasos,
    warnings,
  };
}
