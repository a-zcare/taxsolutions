import { finishOAuth } from '@/lib/video/oauth';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    await rateLimit('oauth-callback', 20);
    const u = new URL(req.url);
    await finishOAuth(
      (await params).provider,
      u.searchParams.get('state') ?? '',
      u.searchParams.get('code') ?? '',
    );
    return NextResponse.redirect(
      new URL('/workspace?oauth=connected', process.env.APP_URL),
    );
  } catch {
    return NextResponse.redirect(
      new URL('/workspace?oauth=failed', process.env.APP_URL),
    );
  }
}
