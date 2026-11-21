import {
  listDocumentTemplates,
  removeDocumentTemplate,
} from '@/lib/document-ai-templates';
import { failure } from '@/lib/http';
import { rateLimit, requireActor, sameOrigin } from '@/lib/security';
import { assertManager } from '@/lib/v2/policy';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const actor = await requireActor();
    assertManager(actor);
    return Response.json(await listDocumentTemplates(), { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await sameOrigin();
    const actor = await requireActor();
    assertManager(actor);
    await rateLimit('document-ai-template-write', 30, actor.id);
    await removeDocumentTemplate(
      actor,
      new URL(request.url).searchParams.get('id') ?? '',
    );
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return failure(error);
  }
}
