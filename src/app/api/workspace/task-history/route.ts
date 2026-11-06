import { requireActor } from '@/lib/security';
import { assertAssigned } from '@/lib/v2/policy';
import { db } from '@/lib/db';
import { failure } from '@/lib/http';
import { z } from 'zod';
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse(new URL(req.url).searchParams.get('id'));
    const task = await db.task.findUnique({ where: { id } });
    if (!task) throw Error('NOT_FOUND');
    assertAssigned(actor, task.assignedId);
    return Response.json(
      await db.auditEvent.findMany({
        where: { objectType: 'Task', objectId: id },
        select: { id: true, action: true, fields: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
