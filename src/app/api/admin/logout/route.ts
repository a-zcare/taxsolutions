import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/security';
import { failure } from '@/lib/http';
export async function POST() {
  try {
    await sameOrigin();
    (await cookies()).delete('tax-session');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
