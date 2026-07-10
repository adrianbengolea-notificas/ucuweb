import { NextResponse } from 'next/server';
import { getTopColaboradores } from '@/lib/colaboradores-store';

export async function GET() {
  try {
    const colaboradores = await getTopColaboradores(10);
    return NextResponse.json({ colaboradores });
  } catch {
    return NextResponse.json({ colaboradores: [] });
  }
}
