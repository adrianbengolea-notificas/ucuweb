#!/usr/bin/env node
/**
 * Verifica que el fix de causas quedó bien en Firestore.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import admin from 'firebase-admin';
import { getReclamosSqlConfig, qualified } from './lib/reclamos-sql-config.mjs';
import {
  buildCausaValidationMaps,
  loadCausasCatalog,
  loadCausasRubros,
  loadEmpresasRubros,
  sanitizeCausasForReclamo,
} from './lib/reclamos-sync-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

function initFirebase() {
  if (admin.apps.length) return admin.app();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
    });
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  initFirebase();
  const db = admin.firestore();
  const pool = await sql.connect(getReclamosSqlConfig());

  const [causaRubroPairs, empresaRubroEntries, causasCatalog] = await Promise.all([
    loadCausasRubros(pool),
    loadEmpresasRubros(pool),
    loadCausasCatalog(pool),
  ]);
  const maps = buildCausaValidationMaps(causaRubroPairs, empresaRubroEntries, causasCatalog);

  const snap = await db.collection('reclamos').get();
  const docs = snap.docs.map((d) => d.data()).filter((r) => !r.deletedAt);

  let conCausas = 0;
  let sinCausas = 0;
  let incompatiblesRestantes = 0;
  let huerfanasRestantes = 0;
  let conFix = 0;
  let conLegacyRemovidas = 0;
  let pasajeEnPlanAhorro = 0;

  const problemas = [];

  for (const reclamo of docs) {
    const causas = reclamo.causas ?? [];
    if (reclamo.causasFixAt) conFix += 1;
    if (reclamo.causasLegacyRemovidas?.length) conLegacyRemovidas += 1;

    if (!causas.length) {
      sinCausas += 1;
      continue;
    }
    conCausas += 1;

    const { causas: validas, removidas } = sanitizeCausasForReclamo(reclamo, maps);
    if (removidas.length) {
      for (const c of removidas) {
        if (!maps.activeCausaIds.has(c.id)) huerfanasRestantes += 1;
        else incompatiblesRestantes += 1;
      }
      if (problemas.length < 10) {
        problemas.push({
          id: reclamo.id,
          empresas: (reclamo.empresas ?? []).map((e) => e.nombre).join('; '),
          malas: removidas.map((c) => c.descripcion),
        });
      }
    }

    const esPlan =
      /plan|ahorro/i.test(reclamo.resumen ?? '') ||
      /plan de ahorro|ahorro/i.test(reclamo.hecho ?? '') ||
      (reclamo.empresas ?? []).some((e) => /AHORRO|PLAN|FIAT PLAN/i.test(e.nombre ?? ''));

    const tienePasaje = causas.some((c) => /PASAJE/i.test(c.descripcion ?? ''));
    if (esPlan && tienePasaje) pasajeEnPlanAhorro += 1;
  }

  // Casos puntuales
  const idsCheck = [1447, 1008, 1028];
  const puntual = [];
  for (const id of idsCheck) {
    const doc = await db.collection('reclamos').doc(String(id)).get();
    const r = doc.data();
    if (!r) continue;
    puntual.push({
      id,
      resumen: r.resumen,
      empresas: (r.empresas ?? []).map((e) => e.nombre),
      causas: (r.causas ?? []).map((c) => c.descripcion),
      removidas: (r.causasLegacyRemovidas ?? []).map((c) => c.descripcion),
      fixAt: r.causasFixAt ?? null,
    });
  }

  const meta = await db.collection('migration_meta').doc('reclamos_causas_fix').get();

  console.log('=== VERIFICACIÓN POST-FIX ===\n');
  console.log('Total reclamos:', docs.length);
  console.log('Con causas válidas:', conCausas);
  console.log('Sin causas:', sinCausas);
  console.log('Con causasFixAt:', conFix);
  console.log('Con causasLegacyRemovidas:', conLegacyRemovidas);
  console.log('\n--- Problemas restantes ---');
  console.log('Incompatibles aún en causas[]:', incompatiblesRestantes);
  console.log('Huérfanas aún en causas[]:', huerfanasRestantes);
  console.log('Plan de ahorro + causa pasaje:', pasajeEnPlanAhorro);

  if (problemas.length) {
    console.log('\nEjemplos con problemas:');
    for (const p of problemas) console.log(`  #${p.id}: ${p.malas.join(' | ')}`);
  } else {
    console.log('\n✓ Ninguna causa incompatible/huérfana en causas[]');
  }

  console.log('\n--- Casos puntuales ---');
  for (const p of puntual) {
    console.log(`\n#${p.id} ${p.resumen}`);
    console.log('  Empresa:', p.empresas[0] ?? '—');
    console.log('  Causas actuales:', p.causas.length ? p.causas.join(' · ') : '(ninguna)');
    console.log('  Removidas:', p.removidas.length ? p.removidas.join(' · ') : '(ninguna)');
    console.log('  Fix:', p.fixAt ?? 'no');
  }

  if (meta.exists) {
    console.log('\n--- Meta fix ---');
    console.log(meta.data());
  }

  await pool.close();
  process.exit(incompatiblesRestantes + huerfanasRestantes + pasajeEnPlanAhorro > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
