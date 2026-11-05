import type { Prisma } from '@prisma/client';
import type { Actor } from './policy';
export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor | null,
  action: string,
  objectType: string,
  objectId: string,
  fields: string[] = [],
) {
  await tx.auditEvent.create({
    data: {
      actorId: actor?.id,
      actorRole: actor?.role ?? 'SYSTEM',
      action,
      objectType,
      objectId,
      fields,
    },
  });
}
