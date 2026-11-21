import {
  documentLanguages,
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
  learnDocumentTemplate,
} from '@/lib/document-ocr';
import {
  templateInputSchema,
  listDocumentTemplates,
  saveDocumentTemplate,
} from '@/lib/document-ai-templates';
import { documentTemplateHeader } from '@/lib/document-ai-regions';
import { assertManager } from '@/lib/v2/policy';
import { getDocumentLimits } from '@/lib/document-ai-limits';
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
    const limits = await getDocumentLimits();
    if (action === 'extract' || action === 'teach') {
      const language = params.get('language') ?? 'auto';
      if (!Object.hasOwn(documentLanguages, language)) throw Error('INVALID');
      if (action === 'teach') {
        assertManager(actor);
        await rateLimit('document-ai-template-write', 30, actor.id);
        const encoded = request.headers.get(documentTemplateHeader) ?? '';
        if (!encoded || encoded.length > 4096) throw Error('INVALID');
        let raw: unknown;
        try {
          raw = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        } catch {
          throw Error('INVALID');
        }
        const rule = templateInputSchema.parse(raw);
        const learned = await learnDocumentTemplate(
          request,
          language as DocumentLanguage,
          limits,
          rule,
        );
        const template = await saveDocumentTemplate(actor, learned.rule);
        return Response.json({ template, value: learned.value }, { headers });
      }
      await rateLimit('document-ai', 20, actor.id);
      const result = await extractDocument(
        request,
        language as DocumentLanguage,
        limits,
        await listDocumentTemplates(),
      );
      return Response.json(
        { ...result, reviewEnabled: reviewAvailable() },
        { headers },
      );
    }
    const page = Number(params.get('page'));
    if (!Number.isInteger(page) || page < 1 || page > limits.pages)
      throw Error('INVALID');

    if (action === 'preview') {
      await rateLimit('document-ai-preview', 100, actor.id);
      const image = await renderDocumentPage(request, page, action, limits);
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
      const image = await renderDocumentPage(request, page, action, limits);
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
