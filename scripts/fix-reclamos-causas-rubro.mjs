#!/usr/bin/env node
/**
 * Limpia causas mal asignadas en reclamos según rubro de la empresa.
 *
 * Uso:
 *   npm run fix:reclamos:causas          # dry-run (solo reporte)
 *   npm run fix:reclamos:causas:apply      # aplica en Firestore
 *   npm run fix:reclamos:causas:apply -- --sql   # también desactiva en SQL legacy
 *   node scripts/fix-reclamos-causas-rubro.mjs --limit=50
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import admin from 'firebase-admin';
import { getReclamosSqlConfig, qualified } from './lib/reclamos-sql-config.mjs';
import {
  loadCausasCatalog,
  loadCausasRubros,
  loadEmpresasRubros,
  stripUndefined,
} from './lib/reclamos-sync-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const fixSql = args.includes('--sql');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
const batchSize = Number(process.env.RECLAMOS_SYNC_BATCH || 200);

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

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales Firebase Admin en .env.local');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function buildMaps(causaRubroPairs, empresaRubroEntries, causasCatalog) {
  const causaIdsByRubro = new Map();
  for (const { causaId, rubroId } of causaRubroPairs) {
    const set = causaIdsByRubro.get(rubroId) ?? new Set();
    set.add(causaId);
    causaIdsByRubro.set(rubroId, set);
  }

  const rubroIdsByEmpresa = new Map();
  for (const { empresaId, rubroId } of empresaRubroEntries) {
    const list = rubroIdsByEmpresa.get(empresaId) ?? [];
    if (!list.includes(rubroId)) list.push(rubroId);
    rubroIdsByEmpresa.set(empresaId, list);
  }

  const activeCausaIds = new Set(
    causasCatalog.filter((c) => c.activo !== false).map((c) => c.id)
  );

  return { causaIdsByRubro, rubroIdsByEmpresa, activeCausaIds };
}

function resolveEmpresaRubroIds(reclamo, maps) {
  const empresaIds = reclamo.empresaIds?.length
    ? reclamo.empresaIds
    : (reclamo.empresas ?? []).map((e) => e.id);

  const rubroSet = new Set();
  for (const empresaId of empresaIds) {
    for (const rubroId of maps.rubroIdsByEmpresa.get(empresaId) ?? []) {
      rubroSet.add(rubroId);
    }
  }

  return {
    rubroIds: [...rubroSet],
    sinRubroEmpresa: empresaIds.length > 0 && rubroSet.size === 0,
  };
}

function isCausaCompatible(causaId, rubroIds, maps) {
  if (!rubroIds.length) return true;
  return rubroIds.some((rubroId) => maps.causaIdsByRubro.get(rubroId)?.has(causaId));
}

function validateCausas(reclamo, maps) {
  const causas = reclamo.causas ?? [];
  const { rubroIds, sinRubroEmpresa } = resolveEmpresaRubroIds(reclamo, maps);

  const validas = [];
  const incompatibles = [];
  const huerfanas = [];

  for (const causa of causas) {
    if (!maps.activeCausaIds.has(causa.id)) {
      huerfanas.push(causa);
      continue;
    }
    if (sinRubroEmpresa || isCausaCompatible(causa.id, rubroIds, maps)) {
      validas.push(causa);
    } else {
      incompatibles.push(causa);
    }
  }

  return { validas, incompatibles, huerfanas, sinRubroEmpresa, rubroIds };
}

async function loadMapsFromSql(pool) {
  const [causaRubroPairs, empresaRubroEntries, causasCatalog] = await Promise.all([
    loadCausasRubros(pool),
    loadEmpresasRubros(pool),
    loadCausasCatalog(pool),
  ]);
  return buildMaps(causaRubroPairs, empresaRubroEntries, causasCatalog);
}

async function writeFirestoreBatch(db, items) {
  if (!items.length) return;
  const batch = db.batch();
  for (const item of items) {
    batch.set(db.collection('reclamos').doc(String(item.id)), stripUndefined(item.patch), {
      merge: true,
    });
  }
  await batch.commit();
}

async function deactivateSqlCausas(pool, rows) {
  if (!rows.length) return;
  let done = 0;
  for (const row of rows) {
    if (!row.legacyGuid) continue;
    await pool
      .request()
      .input('guid', sql.UniqueIdentifier, row.legacyGuid)
      .input('idCausa', sql.Int, row.causaId)
      .query(`
        UPDATE ${qualified('reclamos_causas')}
        SET activo = 0
        WHERE id_reclamo = @guid AND id_causa = @idCausa AND activo = 1
      `);
    done += 1;
    if (done % 100 === 0) console.log(`SQL: desactivadas ${done}/${rows.length}`);
  }
  console.log(`SQL: desactivadas ${done} filas en reclamos_causas`);
}

async function main() {
  console.log(
    `Fix causas por rubro${dryRun ? ' (DRY RUN — usar --apply para escribir)' : ''}${fixSql ? ' + SQL' : ''}`
  );

  initFirebase();
  const db = admin.firestore();
  const pool = await sql.connect(getReclamosSqlConfig());
  const maps = await loadMapsFromSql(pool);

  console.log('Mapas:', {
    rubrosConCausas: maps.causaIdsByRubro.size,
    empresasConRubro: maps.rubroIdsByEmpresa.size,
    causasActivas: maps.activeCausaIds.size,
  });

  const snap = await db.collection('reclamos').get();
  let docs = snap.docs.map((doc) => doc.data()).filter((item) => !item.deletedAt);
  if (limit) docs = docs.slice(0, limit);

  const stats = {
    total: docs.length,
    sinCausas: 0,
    ok: 0,
    aCorregir: 0,
    removidasIncompatibles: 0,
    removidasHuerfanas: 0,
    quedanSinCausa: 0,
  };

  const topIncompatibles = new Map();
  const ejemplos = [];
  const firestoreBuffer = [];
  const sqlRows = [];
  const now = new Date().toISOString();

  for (const reclamo of docs) {
    const causas = reclamo.causas ?? [];
    if (!causas.length) {
      stats.sinCausas += 1;
      continue;
    }

    const validation = validateCausas(reclamo, maps);
    const aRemover = [...validation.incompatibles, ...validation.huerfanas];

    if (!aRemover.length) {
      stats.ok += 1;
      continue;
    }

    stats.aCorregir += 1;
    stats.removidasIncompatibles += validation.incompatibles.length;
    stats.removidasHuerfanas += validation.huerfanas.length;
    if (!validation.validas.length) stats.quedanSinCausa += 1;

    for (const causa of validation.incompatibles) {
      topIncompatibles.set(causa.descripcion, (topIncompatibles.get(causa.descripcion) ?? 0) + 1);
    }
    for (const causa of validation.huerfanas) {
      const label = `#${causa.id} (huérfana)`;
      topIncompatibles.set(label, (topIncompatibles.get(label) ?? 0) + 1);
    }

    if (ejemplos.length < 8) {
      ejemplos.push({
        id: reclamo.id,
        empresas: (reclamo.empresas ?? []).map((e) => e.nombre).join('; '),
        removidas: aRemover.map((c) => c.descripcion),
        quedan: validation.validas.map((c) => c.descripcion),
      });
    }

    const patch = {
      causas: validation.validas,
      causasLegacyRemovidas: aRemover,
      causasFixAt: now,
      causasFixSource: 'fix-reclamos-causas-rubro',
    };

    firestoreBuffer.push({ id: reclamo.id, patch });

    const guid = reclamo.legacyGuid;
    if (guid) {
      for (const causa of aRemover) {
        sqlRows.push({ legacyGuid: guid, causaId: causa.id });
      }
    }

    if (firestoreBuffer.length >= batchSize) {
      if (!dryRun) await writeFirestoreBatch(db, firestoreBuffer);
      console.log(`Firestore: ${dryRun ? 'simulados' : 'escritos'} ${firestoreBuffer.length}…`);
      firestoreBuffer.length = 0;
    }
  }

  if (firestoreBuffer.length) {
    if (!dryRun) await writeFirestoreBatch(db, firestoreBuffer);
    console.log(
      `Firestore: ${dryRun ? 'simularía' : 'escribió'} ${firestoreBuffer.length} reclamos más`
    );
  }

  if (fixSql && !dryRun && sqlRows.length) {
    await deactivateSqlCausas(pool, sqlRows);
  } else if (fixSql && dryRun) {
    console.log(`SQL: simularía desactivar ${sqlRows.length} filas (--apply --sql para ejecutar)`);
  }

  console.log('\n=== RESUMEN ===');
  console.log(stats);

  console.log('\nTop causas removidas:');
  [...topIncompatibles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([label, count]) => console.log(`  ${count}x ${label}`));

  if (ejemplos.length) {
    console.log('\nEjemplos:');
    for (const ex of ejemplos) {
      console.log(`  #${ex.id} | ${ex.empresas}`);
      console.log(`    − ${ex.removidas.join(' · ')}`);
      console.log(`    = ${ex.quedan.length ? ex.quedan.join(' · ') : '(sin causas válidas)'}`);
    }
  }

  if (!dryRun) {
    await db.collection('migration_meta').doc('reclamos_causas_fix').set(
      {
        appliedAt: now,
        stats,
        sqlDeactivated: fixSql ? sqlRows.length : 0,
      },
      { merge: true }
    );
  }

  await pool.close();
  console.log(dryRun ? '\nListo (dry-run). Corré con --apply para aplicar.' : '\nFix aplicado.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
