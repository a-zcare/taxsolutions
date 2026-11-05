import { beginOAuth } from '@/lib/video/oauth';
import { sameOrigin, requireActor, rateLimit } from '@/lib/security';
import { failure } from '@/lib/http';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  void req;
  try {
    await sameOrigin();
    const actor = await requireActor();
    await rateLimit('oauth-start', 10);
    return Response.json(
      { url: await beginOAuth(actor, (await params).provider) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
