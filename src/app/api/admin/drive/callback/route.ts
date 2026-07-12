import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  parseOAuthState,
  saveDriveConnection,
} from '@/lib/drive-auth';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${BASE_URL}/admin/perfil?driveStatus=error&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${BASE_URL}/admin/perfil?driveStatus=error&reason=missing_params`);
  }

  try {
    const { adminEmail } = parseOAuthState(state);
    const { refreshToken, googleEmail } = await exchangeCodeForTokens(code);

    await saveDriveConnection(adminEmail, {
      googleEmail,
      refreshToken,
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(`${BASE_URL}/admin/perfil?driveStatus=connected`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    return NextResponse.redirect(
      `${BASE_URL}/admin/perfil?driveStatus=error&reason=${encodeURIComponent(reason)}`
    );
  }
}
