import { db } from '../db';
import { defaultSchedule, type Schedule } from '../defaults';
import { slotsForDay } from '../calendar';
import type { Prisma } from '@prisma/client';
export const resourceId = (staffId?: string | null) =>
  staffId ? `staff:${staffId}` : 'default';
export async function resourceSchedule(
  tx: Prisma.TransactionClient,
  staffId?: string | null,
  serviceId?: string,
) {
  const row = await tx.setting.findUnique({ where: { key: 'schedule' } });
  let override: object = {};
  if (staffId) {
    const staff = await tx.staff.findUnique({ where: { id: staffId } });
    if (
      !staff?.active ||
      !staff.acceptsBookings ||
      (serviceId &&
        !staff.specializations.includes(serviceId) &&
        !staff.specializations.includes('general'))
    )
      throw Error('INVALID');
    override = (staff.schedule as object) ?? {};
  }
  return {
    ...defaultSchedule,
    ...((row?.value as object) ?? {}),
    ...override,
  } as Schedule;
}
export async function availableSlots(
  date: string,
  serviceId: string,
  staffId?: string,
) {
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service?.active) throw Error('INVALID');
  const rules = await resourceSchedule(db, staffId, serviceId);
  const noon = new Date(`${date}T12:00Z`);
  if (!Number.isFinite(noon.getTime())) throw Error('INVALID');
  const rows = await db.booking.findMany({
    where: {
      resourceId: resourceId(staffId),
      status: { in: ['PENDING', 'CONFIRMED'] },
      blockedEnd: { gt: new Date(noon.getTime() - 86400000) },
      blockedStart: { lt: new Date(noon.getTime() + 86400000) },
    },
    select: { blockedStart: true, blockedEnd: true },
  });
  return slotsForDay(
    date,
    service.duration,
    rules,
    rows.map((b) => ({ start: b.blockedStart, end: b.blockedEnd })),
  );
}
