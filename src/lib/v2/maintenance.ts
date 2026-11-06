import { db } from '../db';
import { notify } from './notifications';
import { bookingEvent, queueVideo } from './booking-events';
import { nextDeadline } from './planner';
import { audit } from './audit';
export async function maintainPlatform(now = new Date()) {
  return db.$transaction(
    async (tx) => {
      const lock = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(740219) AS locked`;
      if (!lock[0].locked) return;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      const abandoned = await tx.booking.findMany({
        where: {
          status: 'PENDING',
          pendingSince: { lt: new Date(now.getTime() - 24 * 3600000) },
        },
        take: 100,
      });
      for (const b of abandoned) {
        const updated = await tx.booking.update({
          where: { id: b.id },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        });
        await bookingEvent(tx, updated, 'cancelled');
        if (b.format === 'ONLINE') await queueVideo(tx, updated, 'DELETE');
        await audit(tx, null, 'BOOKING_EXPIRED', 'Booking', b.id);
      }

      const bookings = await tx.booking.findMany({
        where: {
          status: 'CONFIRMED',
          reminderSentAt: null,
          start: { gte: now, lte: new Date(now.getTime() + 24 * 3600000) },
        },
        take: 100,
      });
      for (const b of bookings) {
        await bookingEvent(tx, b, 'reminder');
        await tx.booking.update({
          where: { id: b.id },
          data: { reminderSentAt: now },
        });
      }
      const tasks = await tx.task.findMany({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS'] },
          assignedId: { not: null },
          dueAt: { lte: new Date(now.getTime() + 24 * 3600000) },
          OR: [
            { reminderSentAt: null },
            { overdueSentAt: null, dueAt: { lt: now } },
          ],
        },
        include: { assigned: true },
        take: 100,
      });
      for (const task of tasks) {
        if (!task.assigned?.active) continue;
        const overdue = task.dueAt < now;
        await notify(tx, {
          to: task.assigned.email,
          locale: task.assigned.locale,
          kind: overdue ? 'overdue' : 'task',
          id: task.id,
          dedup: `task:${task.id}:${overdue ? 'overdue' : 'reminder'}`,
          link: `${process.env.APP_URL}/workspace`,
        });
        await tx.task.update({
          where: { id: task.id },
          data: overdue ? { overdueSentAt: now } : { reminderSentAt: now },
        });
      }
      const recurring = await tx.task.findMany({
        where: {
          recurrence: { not: 'NONE' },
          recurrenceSpawnedAt: null,
          status: { not: 'CANCELLED' },
          dueAt: { lte: now },
        },
        take: 50,
      });
      for (const t of recurring) {
        await tx.task.create({
          data: {
            title: t.title,
            description: t.description,
            priority: t.priority,
            category: t.category,
            estimatedMinutes: t.estimatedMinutes,
            dueAt: nextDeadline(t.dueAt, t.recurrence),
            hardDeadline: t.hardDeadline,
            recurrence: t.recurrence,
            recurrenceParentId: t.id,
            assignedId: t.assignedId,
            createdById: t.createdById,
            clientId: t.clientId,
          },
        });
        await tx.task.update({
          where: { id: t.id },
          data: { recurrenceSpawnedAt: now },
        });
        await audit(tx, null, 'TASK_RECURRENCE', 'Task', t.id, [
          'recurrenceSpawnedAt',
        ]);
      }
      const cutoff = new Date(now.getTime() - 180 * 86400000);
      const expiredMeetings = await tx.booking.findMany({
        where: {
          end: { lt: cutoff },
          meeting: { status: { not: 'CANCELLED' }, externalId: { not: null } },
        },
        take: 25,
      });
      for (const b of expiredMeetings) await queueVideo(tx, b, 'DELETE');
      await tx.booking.deleteMany({
        where: {
          end: { lt: cutoff },
          OR: [{ meeting: null }, { meeting: { status: 'CANCELLED' } }],
        },
      });
      await tx.outbox.deleteMany({
        where: {
          OR: [
            { sentAt: { lt: new Date(now.getTime() - 30 * 86400000) } },
            { createdAt: { lt: cutoff } },
          ],
        },
      });
      await tx.inquiry.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await tx.task.deleteMany({
        where: {
          status: { in: ['DONE', 'CANCELLED'] },
          updatedAt: { lt: new Date(now.getTime() - 365 * 86400000) },
          OR: [
            { recurrence: 'NONE' },
            { recurrenceSpawnedAt: { not: null } },
            { status: 'CANCELLED' },
          ],
        },
      });
      await tx.staffSession.deleteMany({ where: { expiresAt: { lt: now } } });
      await tx.oAuthFlow.deleteMany({ where: { expiresAt: { lt: now } } });
      await tx.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
      await tx.setting.upsert({
        where: { key: 'worker.heartbeat' },
        create: { key: 'worker.heartbeat', value: { at: now.toISOString() } },
        update: { value: { at: now.toISOString() } },
      });
    },
    { timeout: 20000 },
  );
}
