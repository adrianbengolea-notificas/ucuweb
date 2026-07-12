import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-session';
import { computeReclamoEstadisticas } from '@/lib/reclamos-stats';
import type { ReclamoAdminBandeja } from '@/types/reclamos';
import type { ReclamoEstadisticasFilters } from '@/types/reclamos-stats';

const BANDEJAS = new Set<ReclamoAdminBandeja>(['recibidos', 'gestion', 'archivados']);

function parsePositiveInt(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseBool(value: string | null): boolean | undefined {
  if (value === '1' || value === 'true') return true;
  return undefined;
}

function parseFilters(request: NextRequest): ReclamoEstadisticasFilters {
  const params = request.nextUrl.searchParams;
  const filters: ReclamoEstadisticasFilters = {};

  const dateFrom = params.get('dateFrom')?.trim();
  const dateTo = params.get('dateTo')?.trim();
  const bandeja = params.get('bandeja')?.trim();
  const responsableEmail = params.get('responsableEmail')?.trim();

  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;
  if (bandeja && BANDEJAS.has(bandeja as ReclamoAdminBandeja)) {
    filters.bandeja = bandeja as ReclamoAdminBandeja;
  }
  if (responsableEmail) filters.responsableEmail = responsableEmail;

  const idGrupoEstado = parsePositiveInt(params.get('idGrupoEstado'));
  const empresaId = parsePositiveInt(params.get('empresaId'));
  const causaId = parsePositiveInt(params.get('causaId'));
  const idCasoEstado = parsePositiveInt(params.get('idCasoEstado'));
  const provinciaId = parsePositiveInt(params.get('provinciaId'));

  if (idGrupoEstado != null) filters.idGrupoEstado = idGrupoEstado;
  if (empresaId != null) filters.empresaId = empresaId;
  if (causaId != null) filters.causaId = causaId;
  if (idCasoEstado != null) filters.idCasoEstado = idCasoEstado;
  if (provinciaId != null) filters.provinciaId = provinciaId;

  if (parseBool(params.get('sinResponsable'))) filters.sinResponsable = true;
  if (parseBool(params.get('sinAsignar'))) filters.sinAsignar = true;
  if (parseBool(params.get('enJuicio'))) filters.enJuicio = true;
  if (parseBool(params.get('conExpediente'))) filters.conExpediente = true;
  if (parseBool(params.get('conComunicaciones'))) filters.conComunicaciones = true;
  if (parseBool(params.get('esExterno'))) filters.esExterno = true;

  return filters;
}

export async function GET(request: NextRequest) {
  const session = requireAdminPermission(request, 'reclamos:read');
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const stats = await computeReclamoEstadisticas(parseFilters(request));
    return NextResponse.json(stats);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Firebase no configurado' }, { status: 500 });
  }
}
