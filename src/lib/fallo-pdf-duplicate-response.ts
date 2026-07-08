import { NextResponse } from 'next/server';
import { DuplicateFalloPdfError } from '@/lib/fallo-pdf-duplicate-error';

export function duplicateFalloPdfResponse(error: DuplicateFalloPdfError) {
  return NextResponse.json(
    {
      error: error.message,
      duplicate: true,
      fallo: error.fallo,
    },
    { status: 409 }
  );
}
