import { NextResponse } from 'next/server';
import { sameOrigin, logoutSession } from '@/lib/security';
import { failure } from '@/lib/http';
export async function POST() {
  try {
    await sameOrigin();
    await logoutSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
