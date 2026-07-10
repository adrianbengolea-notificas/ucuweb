import { NextRequest, NextResponse } from 'next/server';
import { getColaboradorByUid } from '@/lib/colaboradores-store';
import { requireColaboradorSession } from '@/lib/colaborador-session';

export async function GET(request: NextRequest) {
  const session = requireColaboradorSession(request);
  if (!session) {
    return NextResponse.json({ colaborador: null });
  }

  try {
    const colaborador = await getColaboradorByUid(session.uid);
    if (!colaborador) {
      return NextResponse.json({ colaborador: null });
    }

    return NextResponse.json({
      colaborador: {
        uid: colaborador.uid,
        email: colaborador.email,
        name: colaborador.name,
        photoUrl: colaborador.photoUrl,
        fallosCount: colaborador.fallosCount,
        commentsCount: colaborador.commentsCount,
        score: colaborador.score,
      },
    });
  } catch {
    return NextResponse.json({
      colaborador: {
        uid: session.uid,
        email: session.email,
        name: session.name,
        photoUrl: session.photoUrl,
        fallosCount: 0,
        commentsCount: 0,
        score: 0,
      },
    });
  }
}
