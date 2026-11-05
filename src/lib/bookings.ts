import { randomUUID } from 'node:crypto';
import { db } from './db';
import { hash, token } from './security';
import { slotsForDay, dateInRiga } from './calendar';
import { bookingInput } from './validation';
import { seal } from './v2/crypto';
import { resourceId, resourceSchedule } from './v2/availability';
import { bookingEvent, queueVideo } from './v2/booking-events';
import { audit } from './v2/audit';
import { assertAssigned, type Actor } from './v2/policy';
import type { Prisma } from '@prisma/client';
async function validateSlot(
  tx: Prisma.TransactionClient,
  date: Date,
  duration: number,
  staffId: string | null | undefined,
  excludeId?: string,
  serviceId?: string,
) {
  const rules = await resourceSchedule(tx, staffId, serviceId);
  const end = new Date(date.getTime() + duration * 60000);
  const rows = await tx.booking.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      resourceId: resourceId(staffId),
      status: { in: ['PENDING', 'CONFIRMED'] },
      blockedStart: {
        lt: new Date(end.getTime() + rules.bufferMinutes * 60000),
      },
      blockedEnd: {
        gt: new Date(date.getTime() - rules.bufferMinutes * 60000),
      },
    },
    select: { blockedStart: true, blockedEnd: true },
  });
  if (
    !slotsForDay(
      dateInRiga(date),
      duration,
      rules,
      rows.map((b) => ({ start: b.blockedStart, end: b.blockedEnd })),
    ).includes(date.toISOString())
  )
    throw Error('CONFLICT');
  return { end, bufferMinutes: rules.bufferMinutes };
}
export async function createBooking(raw: unknown) {
  const input = bookingInput.parse(raw),
    cancelToken = token(),
    id = randomUUID();
  const b = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      const service = await tx.service.findUnique({
        where: { id: input.serviceId },
      });
      if (!service?.active) throw Error('INVALID');
      const start = new Date(input.start);
      const slot = await validateSlot(
        tx,
        start,
        service.duration,
        input.staffId,
        undefined,
        service.id,
      );
      const { consent, website, ...data } = input;
      void consent;
      void website;
      const booking = await tx.booking.create({
        data: {
          ...data,
          id,
          start,
          ...slot,
          resourceId: resourceId(input.staffId),
          blockedStart: start,
          blockedEnd: slot.end,
          tokenHash: hash(cancelToken),
          manageTokenCiphertext: seal(cancelToken, `booking:${id}`),
        },
      });
      await bookingEvent(tx, booking, 'requested');
      await audit(tx, null, 'BOOKING_REQUEST', 'Booking', id);
      return booking;
    },
    { timeout: 15000 },
  );
  return { id: b.id, cancelToken };
}
export async function cancelBooking(cancelToken: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
    const b = await tx.booking.findUnique({
      where: { tokenHash: hash(cancelToken) },
    });
    if (!b) throw Error('INVALID');
    if (b.status === 'CANCELLED') return;
    if (b.status === 'COMPLETED') throw Error('INVALID');
    const updated = await tx.booking.update({
      where: { id: b.id },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    await bookingEvent(tx, updated, 'cancelled');
    if (updated.format === 'ONLINE') await queueVideo(tx, updated, 'DELETE');
    await audit(tx, null, 'BOOKING_CANCEL', 'Booking', b.id);
  });
}
export async function rescheduleBooking(
  input: { token?: string; id?: string; start: string; staffId?: string },
  actor?: Actor,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      const b = await tx.booking.findUnique({
        where: input.token
          ? { tokenHash: hash(input.token) }
          : { id: input.id },
      });
      if (!b) throw Error('NOT_FOUND');
      if (actor) assertAssigned(actor, b.staffId);
      else if (!input.token) throw Error('UNAUTHORIZED');
      if (!['PENDING', 'CONFIRMED'].includes(b.status) || b.start < new Date())
        throw Error('INVALID');
      if (
        input.staffId &&
        input.staffId !== b.staffId &&
        b.status !== 'PENDING'
      )
        throw Error('INVALID');
      const staffId = input.staffId ?? b.staffId,
        start = new Date(input.start);
      if (!Number.isFinite(start.getTime())) throw Error('INVALID');
      const slot = await validateSlot(
        tx,
        start,
        (b.end.getTime() - b.start.getTime()) / 60000,
        staffId,
        b.id,
        b.serviceId,
      );
      const updated = await tx.booking.update({
        where: { id: b.id },
        data: {
          start,
          ...slot,
          staffId,
          resourceId: resourceId(staffId),
          version: { increment: 1 },
          reminderSentAt: null,
          pendingSince: new Date(),
          status:
            b.format === 'ONLINE' && b.status === 'CONFIRMED'
              ? 'PENDING'
              : b.status,
        },
      });
      await bookingEvent(tx, updated, 'rescheduled');
      if (updated.format === 'ONLINE' && b.status === 'CONFIRMED')
        await queueVideo(tx, updated);
      await audit(tx, actor ?? null, 'BOOKING_RESCHEDULE', 'Booking', b.id, [
        'start',
        'end',
      ]);
      return { id: b.id, start: updated.start, end: updated.end };
    },
    { timeout: 15000 },
  );
}
export async function bookingStatus(
  tx: Prisma.TransactionClient,
  actor: Actor,
  id: string,
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
  const b = await tx.booking.findUnique({ where: { id } });
  if (!b) throw Error('NOT_FOUND');
  assertAssigned(actor, b.staffId);
  if (['CANCELLED', 'COMPLETED'].includes(b.status) && status !== b.status)
    throw Error('INVALID');
  if (status === 'COMPLETED' && b.end > new Date()) throw Error('INVALID');
  if (status === b.status) return;
  const onlineConfirmation = status === 'CONFIRMED' && b.format === 'ONLINE';
  const updated = await tx.booking.update({
    where: { id },
    data: {
      status: onlineConfirmation ? 'PENDING' : status,
      ...(onlineConfirmation ? { pendingSince: new Date() } : {}),
      version: { increment: 1 },
    },
  });
  if (onlineConfirmation) await queueVideo(tx, updated);
  else if (status === 'CONFIRMED' || status === 'CANCELLED')
    await bookingEvent(
      tx,
      updated,
      status === 'CONFIRMED' ? 'confirmed' : 'cancelled',
    );
  if (status === 'CANCELLED' && b.format === 'ONLINE')
    await queueVideo(tx, updated, 'DELETE');
  await audit(tx, actor, 'BOOKING_STATUS', 'Booking', id, ['status']);
}
