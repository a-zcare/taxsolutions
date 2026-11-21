import {
  documentLanguages,
  maxDocumentPages,
  type DocumentLanguage,
} from '@/lib/document-ai-options';
import {
  reviewAvailable,
  reviewDocumentImage,
  reviewFields,
} from '@/lib/document-ai-review';
import {
  DocumentOcrError,
  extractDocument,
  renderDocumentPage,
} from '@/lib/document-ocr';
import { failure } from '@/lib/http';
import { rateLimit, requireActor, sameOrigin } from '@/lib/security';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  try {
    await sameOrigin();
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    const action = params.get('action') ?? 'extract';
    if (action === 'extract') {
      const language = params.get('language') ?? 'auto';
      if (!Object.hasOwn(documentLanguages, language)) throw Error('INVALID');
      await rateLimit('document-ai', 20, actor.id);
      const pages = await extractDocument(
        request,
        language as DocumentLanguage,
      );
      return Response.json(
        { pages, reviewEnabled: reviewAvailable() },
        { headers },
      );
    }
    const page = Number(params.get('page'));
    if (!Number.isInteger(page) || page < 1 || page > maxDocumentPages)
      throw Error('INVALID');

    if (action === 'preview') {
      await rateLimit('document-ai-preview', 100, actor.id);
      const image = await renderDocumentPage(request, page, action);
      return new Response(new Uint8Array(image.bytes), {
        headers: { ...headers, 'Content-Type': image.type },
      });
    }
    if (action === 'review') {
      if (!reviewAvailable())
        throw new DocumentOcrError('REVIEW_UNAVAILABLE', 503);
      const raw = request.headers.get('x-document-fields') ?? '';
      if (!raw || raw.length > 8192) throw Error('INVALID');
      let fields: unknown;
      try {
        fields = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      } catch {
        throw Error('INVALID');
      }
      await rateLimit('document-ai-review', 15, actor.id);
      const checked = reviewFields.parse(fields);
      const image = await renderDocumentPage(request, page, action);
      const values = await reviewDocumentImage(
        image.bytes,
        checked,
        request.signal,
      );
      return Response.json({ values }, { headers });
    }
    throw Error('INVALID');
  } catch (error) {
    if (error instanceof DocumentOcrError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers },
      );
    return failure(error);
  }
}
