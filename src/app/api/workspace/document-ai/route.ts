import {
  documentLanguages,
  type DocumentLanguage,
} from '@/lib/document-ai-options';
import { DocumentOcrError, extractDocument } from '@/lib/document-ocr';
import { failure } from '@/lib/http';
import { rateLimit, requireActor, sameOrigin } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await sameOrigin();
    const actor = await requireActor();
    const language =
      new URL(request.url).searchParams.get('language') ?? 'auto';
    if (!Object.hasOwn(documentLanguages, language)) throw Error('INVALID');
    await rateLimit('document-ai', 15, actor.id);
    const pages = await extractDocument(request, language as DocumentLanguage);
    return Response.json(
      { pages },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof DocumentOcrError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    return failure(error);
  }
}
