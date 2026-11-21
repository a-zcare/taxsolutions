import { db } from '@/lib/db';
import {
  documentLimitsKey,
  documentLimitsSchema,
  getDocumentLimits,
} from '@/lib/document-ai-limits';
import { failure, json } from '@/lib/http';
import { rateLimit, requireActor, sameOrigin } from '@/lib/security';
import { audit } from '@/lib/v2/audit';
import { assertManager } from '@/lib/v2/policy';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    await requireActor();
    return Response.json(await getDocumentLimits(), { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    await sameOrigin();
    const actor = await requireActor();
    assertManager(actor);
    await rateLimit('document-ai-settings', 30, actor.id);
    const value = documentLimitsSchema.parse(await json(request));
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: documentLimitsKey },
        create: { key: documentLimitsKey, value },
        update: { value },
      });
      await audit(
        tx,
        actor,
        'DOCUMENT_AI_LIMITS_UPDATE',
        'Setting',
        documentLimitsKey,
        Object.keys(value),
      );
    });
    return Response.json(value, { headers });
  } catch (error) {
    return failure(error);
  }
}
