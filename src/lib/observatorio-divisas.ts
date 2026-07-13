import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import type { DivisaOption } from '@/types/observatorio';
import {
  DIVISA_CANASTA_BASICA,
  DIVISA_CANASTA_CODIGO,
  DIVISA_CANASTA_ID,
  isCanastaBasicaDivisa,
} from '@/lib/observatorio-divisas-shared';

export {
  DIVISA_CANASTA_BASICA,
  DIVISA_CANASTA_CODIGO,
  DIVISA_CANASTA_ID,
  DIVISA_PESOS_CODIGO,
  DIVISA_PESOS_ID,
  findDivisaIdByCodigo,
  isCanastaBasicaDivisa,
  isPesosDivisa,
  resolveDivisaCodigoFromText,
} from '@/lib/observatorio-divisas-shared';

export async function ensureCanastaBasicaDivisa(): Promise<DivisaOption> {
  const db = getAdminDb();
  if (!db) return DIVISA_CANASTA_BASICA;

  const col = db.collection('observatorio_divisas');
  const byCodigo = await col.where('codigo', '==', DIVISA_CANASTA_CODIGO).limit(1).get();
  if (!byCodigo.empty) {
    const data = byCodigo.docs[0].data();
    return {
      id: Number(data.id) || DIVISA_CANASTA_ID,
      codigo: String(data.codigo ?? DIVISA_CANASTA_CODIGO),
      nombre: String(data.nombre ?? DIVISA_CANASTA_BASICA.nombre),
      pais: data.pais ? String(data.pais) : 'Argentina',
    };
  }

  const byId = await col.doc(String(DIVISA_CANASTA_ID)).get();
  if (byId.exists) {
    const data = byId.data() ?? {};
    const codigo = String(data.codigo ?? '').toUpperCase();
    if (
      codigo === DIVISA_CANASTA_CODIGO ||
      isCanastaBasicaDivisa({ codigo, nombre: String(data.nombre ?? '') })
    ) {
      return {
        id: DIVISA_CANASTA_ID,
        codigo: codigo || DIVISA_CANASTA_CODIGO,
        nombre: String(data.nombre ?? DIVISA_CANASTA_BASICA.nombre),
        pais: data.pais ? String(data.pais) : 'Argentina',
      };
    }
  }

  await col.doc(String(DIVISA_CANASTA_ID)).set(DIVISA_CANASTA_BASICA, { merge: true });
  return DIVISA_CANASTA_BASICA;
}
