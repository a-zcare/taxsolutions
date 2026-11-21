import { z } from 'zod';
import {
  archivedDocument,
  archivedFile,
  archiveReviewSchema,
  saveArchiveReview,
} from '@/lib/document-archive';
import { reviewAvailable } from '@/lib/document-ai-review';
import { failure, json } from '@/lib/http';
import { rateLimit, requireActor, sameOrigin } from '@/lib/security';

type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    await rateLimit('document-archive-read', 300, actor.id);
    if (new URL(request.url).searchParams.has('file')) {
      const file = await archivedFile(actor, id);
      return new Response(new Uint8Array(file.bytes), {
        headers: {
          ...headers,
          'Content-Type': file.mimeType,
          'Content-Disposition': 'attachment',
        },
      });
    }
    return Response.json(
      {
        ...(await archivedDocument(actor, id)),
        reviewEnabled: reviewAvailable(),
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    await sameOrigin();
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    await rateLimit('document-archive-write', 100, actor.id);
    const input = archiveReviewSchema.parse(await json(request, 96 * 1024));
    return Response.json(await saveArchiveReview(actor, id, input), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
