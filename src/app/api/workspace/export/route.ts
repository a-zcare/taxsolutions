import { requireActor } from '@/lib/security';
import { assertOwner } from '@/lib/v2/policy';
import { db } from '@/lib/db';
import { audit } from '@/lib/v2/audit';
import { failure } from '@/lib/http';
import { z } from 'zod';
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    assertOwner(actor);
    const id = z.uuid().parse(new URL(req.url).searchParams.get('clientId'));
    const value = await db.$transaction(async (tx) => {
      const client = await tx.client.findUniqueOrThrow({ where: { id } });
      const [bookings, tasks, inquiries] = await Promise.all([
        tx.booking.findMany({
          where: { email: client.email },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            comment: true,
            serviceId: true,
            start: true,
            end: true,
            status: true,
            format: true,
            createdAt: true,
          },
        }),
        tx.task.findMany({
          where: { clientId: id },
          include: { comments: { select: { body: true, createdAt: true } } },
        }),
        tx.inquiry.findMany({
          where: { email: client.email },
          select: {
            name: true,
            email: true,
            message: true,
            createdAt: true,
            status: true,
          },
        }),
      ]);
      await audit(tx, actor, 'CLIENT_EXPORT', 'Client', id);
      return { client, bookings, tasks, inquiries };
    });
    return Response.json(value, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition':
          'attachment; filename="taxsolutions-personal-data.json"',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
