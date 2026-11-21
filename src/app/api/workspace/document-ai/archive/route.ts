import { z } from 'zod';
import {
  accountingCsv,
  archiveClients,
  archivedDocuments,
  archivePeriodSchema,
} from '@/lib/document-archive';
import { failure } from '@/lib/http';
import { rateLimit, requireActor } from '@/lib/security';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    if (params.get('action') === 'clients') {
      await rateLimit('document-archive-read', 300, actor.id);
      const query = z
        .string()
        .trim()
        .max(120)
        .parse(params.get('q') ?? '');
      const selected = z
        .uuid()
        .optional()
        .parse(params.get('selected') || undefined);
      return Response.json(await archiveClients(actor, query, selected), {
        headers,
      });
    }
    const clientId = z.uuid().parse(params.get('clientId'));
    const period = archivePeriodSchema.parse(params.get('period'));
    if (params.get('action') === 'export') {
      await rateLimit('document-archive-export', 20, actor.id);
      return new Response(await accountingCsv(actor, clientId, period), {
        headers: {
          ...headers,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="taxsolutions-${period}.csv"`,
        },
      });
    }
    await rateLimit('document-archive-read', 300, actor.id);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(2500)
      .parse(params.get('page') ?? 0);
    const status = z
      .enum(['', 'PENDING', 'CONFIRMED'])
      .parse(params.get('status') ?? '');
    return Response.json(
      await archivedDocuments(actor, clientId, period, page, status),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
