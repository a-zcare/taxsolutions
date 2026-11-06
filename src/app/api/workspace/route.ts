import { requireActor, sameOrigin, rateLimit } from '@/lib/security';
import { workspaceData, workspaceAction } from '@/lib/v2/workspace';
import { failure, json } from '@/lib/http';
import { z } from 'zod';
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    await rateLimit('workspace-read', 1000);
    return Response.json(
      await workspaceData(actor, new URL(req.url).searchParams),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await sameOrigin();
    const actor = await requireActor();
    await rateLimit('workspace-write', 300);
    const v = z
      .object({ action: z.string().max(40), data: z.unknown() })
      .parse(await json(req));
    return Response.json(await workspaceAction(actor, v.action, v.data), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
