import 'server-only';

import { getAdminDb } from '@/lib/firebase-admin';
import { getAccessTokenForAdmin } from '@/lib/drive-auth';
import { analizarDocumentoDriveParaReclamo } from '@/lib/gemini';
import { getReclamoByIdFromFirestore } from '@/lib/reclamos-store';
import type { SugerenciaDrive } from '@/types/reclamos';
import type { Firestore } from 'firebase-admin/firestore';

function dbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no configurado.');
  return db;
}

const RECLAMOS_COLLECTION = 'reclamos';
const SUGERENCIAS_SUBCOLLECTION = 'sugerencias';

const MIME_ANALIZABLES = new Set([
  'application/pdf',
  'application/vnd.google-apps.document',
]);

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
};

async function listNewDriveFiles(
  accessToken: string,
  folderId: string,
  since: string
): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and modifiedTime > '${since}' and trashed = false`;
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Drive API error ${res.status}`);
  }

  const data = (await res.json()) as { files?: DriveFile[] };
  return (data.files ?? []).filter((f) => MIME_ANALIZABLES.has(f.mimeType));
}

async function downloadFileAsBase64(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  const url =
    mimeType === 'application/vnd.google-apps.document'
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`No se pudo descargar archivo ${fileId}: ${res.status}`);

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function saveSugerencia(
  reclamoId: number,
  sugerencia: Omit<SugerenciaDrive, 'id'>
): Promise<string> {
  const db = dbOrThrow();
  const ref = await db
    .collection(RECLAMOS_COLLECTION)
    .doc(String(reclamoId))
    .collection(SUGERENCIAS_SUBCOLLECTION)
    .add(sugerencia);
  return ref.id;
}

async function archivoYaProcesado(reclamoId: number, archivoId: string): Promise<boolean> {
  const db = dbOrThrow();
  const snap = await db
    .collection(RECLAMOS_COLLECTION)
    .doc(String(reclamoId))
    .collection(SUGERENCIAS_SUBCOLLECTION)
    .where('archivoId', '==', archivoId)
    .limit(1)
    .get();
  return !snap.empty;
}

export type SyncReclamoResult = {
  reclamoId: number;
  archivosNuevos: number;
  sugerenciasCreadas: number;
  errores: string[];
};

export async function syncReclamoConDrive(
  reclamoId: number,
  adminEmail: string
): Promise<SyncReclamoResult> {
  const result: SyncReclamoResult = {
    reclamoId,
    archivosNuevos: 0,
    sugerenciasCreadas: 0,
    errores: [],
  };

  const reclamo = await getReclamoByIdFromFirestore(reclamoId);
  if (!reclamo?.driveFolderId) return result;

  const accessToken = await getAccessTokenForAdmin(adminEmail);
  const since = reclamo.driveLastCheckedAt ?? reclamo.createdAt;
  const archivos = await listNewDriveFiles(accessToken, reclamo.driveFolderId, since);
  result.archivosNuevos = archivos.length;

  for (const archivo of archivos) {
    try {
      const yaProcesado = await archivoYaProcesado(reclamoId, archivo.id);
      if (yaProcesado) continue;

      const pdfBase64 = await downloadFileAsBase64(accessToken, archivo.id, archivo.mimeType);
      const analisis = await analizarDocumentoDriveParaReclamo(pdfBase64, {
        reclamoId,
        resumen: reclamo.resumen,
        empresas: reclamo.empresas.map((e) => e.nombre).join(', '),
        estadoActual: reclamo.estadoDescripcion ?? 'Desconocido',
        nombreArchivo: archivo.name,
      });

      if (analisis.confianza !== 'baja') {
        await saveSugerencia(reclamoId, {
          reclamoId,
          archivoId: archivo.id,
          archivoNombre: archivo.name,
          archivoUrl: archivo.webViewLink,
          movimientoSugerido: analisis.movimientoSugerido,
          razonamiento: analisis.razonamiento,
          fechaDeteccion: new Date().toISOString(),
          estado: 'pendiente',
        });
        result.sugerenciasCreadas++;
      }
    } catch (err) {
      result.errores.push(`${archivo.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const db = dbOrThrow();
  await db
    .collection(RECLAMOS_COLLECTION)
    .doc(String(reclamoId))
    .update({ driveLastCheckedAt: new Date().toISOString() });

  return result;
}

export async function listSugerenciasPendientes(reclamoId: number): Promise<SugerenciaDrive[]> {
  const db = dbOrThrow();
  const snap = await db
    .collection(RECLAMOS_COLLECTION)
    .doc(String(reclamoId))
    .collection(SUGERENCIAS_SUBCOLLECTION)
    .where('estado', '==', 'pendiente')
    .orderBy('fechaDeteccion', 'desc')
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<SugerenciaDrive, 'id'>),
  }));
}

export async function actualizarEstadoSugerencia(
  reclamoId: number,
  sugerenciaId: string,
  estado: 'confirmada' | 'descartada',
  confirmedByEmail: string
): Promise<void> {
  const db = dbOrThrow();
  await db
    .collection(RECLAMOS_COLLECTION)
    .doc(String(reclamoId))
    .collection(SUGERENCIAS_SUBCOLLECTION)
    .doc(sugerenciaId)
    .update({
      estado,
      confirmedByEmail,
      confirmedAt: new Date().toISOString(),
    });
}
