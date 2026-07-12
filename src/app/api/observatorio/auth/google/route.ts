import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { upsertColaboradorFromGoogle } from '@/lib/colaboradores-store';
import { setColaboradorSessionCookie } from '@/lib/colaborador-session';

export async function POST(request: NextRequest) {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json({ error: 'Firebase Admin no configurado' }, { status: 500 });
  }

  let body: { idToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
  if (!idToken) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'La cuenta de Google no tiene email.' }, { status: 403 });
    }

    const colaborador = await upsertColaboradorFromGoogle({
      uid,
      email,
      name: decoded.name || email.split('@')[0] || 'Colaborador',
      photoUrl: decoded.picture,
    });

    const res = NextResponse.json({
      ok: true,
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

    const cookieSet = setColaboradorSessionCookie(res, {
      uid: colaborador.uid,
      email: colaborador.email,
      name: colaborador.name,
      photoUrl: colaborador.photoUrl,
    });

    if (!cookieSet) {
      return NextResponse.json(
        { error: 'Sesión de colaborador no configurada (ADMIN_SESSION_SECRET).' },
        { status: 500 }
      );
    }

    return res;
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar la sesión de Google' }, { status: 401 });
  }
}
