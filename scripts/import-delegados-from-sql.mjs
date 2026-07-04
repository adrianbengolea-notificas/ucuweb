#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';
import admin from 'firebase-admin';
import { getReclamosSqlConfig, qualified } from './lib/reclamos-sql-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function trim(value) {
  return String(value ?? '').trim();
}

function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
    });
    return admin.firestore();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales Firebase Admin en .env.local');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return admin.firestore();
}

function mapLegacyRole(idRol) {
  if (idRol === 1) {
    return { role: 'administrador', reclamosWriteScope: 'all' };
  }
  if (idRol === 2) {
    return { role: 'operador', reclamosWriteScope: 'all' };
  }
  return { role: 'operador', reclamosWriteScope: 'assigned' };
}

function isValidEmail(email) {
  return email.includes('@') && email.includes('.');
}

async function loadLegacyUsers(pool) {
  const result = await pool.request().query(`
    SELECT
      u.id_usuario,
      u.usuario,
      u.id_rol,
      u.activo,
      u.contrasena,
      p.id_persona,
      p.nombre,
      p.apellido,
      p.correo_electronico,
      p.activo AS persona_activa
    FROM ${qualified('usuarios')} u
    INNER JOIN ${qualified('personas')} p ON p.id_persona = u.id_persona
    WHERE u.activo = 1 AND p.activo = 1 AND p.id_persona > 0
    ORDER BY u.id_rol ASC, u.id_usuario ASC
  `);

  const byEmail = new Map();

  for (const row of result.recordset) {
    const email = trim(row.correo_electronico).toLowerCase();
    if (!isValidEmail(email)) {
      console.warn(`Omitido sin email válido: ${row.usuario} (${row.nombre} ${row.apellido})`);
      continue;
    }

    const legacyPasswordHash = Buffer.isBuffer(row.contrasena)
      ? row.contrasena.toString('hex')
      : '';
    if (!legacyPasswordHash) {
      console.warn(`Omitido sin contraseña: ${email}`);
      continue;
    }

    const mapped = mapLegacyRole(Number(row.id_rol));
    const candidate = {
      email,
      name: `${trim(row.nombre)} ${trim(row.apellido)}`.trim() || email.split('@')[0],
      role: mapped.role,
      reclamosWriteScope: mapped.reclamosWriteScope,
      legacyUsername: trim(row.usuario),
      legacyPasswordHash,
      idRol: Number(row.id_rol),
      idUsuario: Number(row.id_usuario),
    };

    const existing = byEmail.get(email);
    if (!existing || candidate.idRol < existing.idRol) {
      if (existing) {
        console.warn(
          `Email duplicado ${email}: conservando rol ${candidate.idRol} (${candidate.legacyUsername})`
        );
      }
      byEmail.set(email, candidate);
    }
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email, 'es'));
}

async function main() {
  console.log(`Importando delegados desde SQL${dryRun ? ' (dry-run)' : ''}…`);

  const pool = await sql.connect(getReclamosSqlConfig());
  const users = await loadLegacyUsers(pool);
  await pool.close();

  console.log(`Usuarios a importar: ${users.length}`);
  console.log(
    'Por rol legacy:',
    users.reduce(
      (acc, user) => {
        acc[user.idRol] = (acc[user.idRol] ?? 0) + 1;
        return acc;
      },
      {}
    )
  );

  if (dryRun) {
    for (const user of users.slice(0, 10)) {
      console.log(
        `- ${user.email} | ${user.name} | ${user.role} | ${user.reclamosWriteScope} | ${user.legacyUsername}`
      );
    }
    if (users.length > 10) console.log(`… y ${users.length - 10} más`);
    return;
  }

  const db = initFirebase();
  const now = new Date().toISOString();
  let batch = db.batch();
  let ops = 0;

  for (const user of users) {
    const ref = db.collection('admin_users').doc(user.email);
    batch.set(
      ref,
      {
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
        reclamosWriteScope: user.reclamosWriteScope,
        legacyUsername: user.legacyUsername,
        legacyPasswordHash: user.legacyPasswordHash,
        updatedAt: now,
        createdAt: now,
        createdBy: 'import-delegados-from-sql',
      },
      { merge: true }
    );
    ops += 1;

    if (ops % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (ops % 400 !== 0) {
    await batch.commit();
  }

  console.log(`Importación completada: ${users.length} usuarios en admin_users.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
