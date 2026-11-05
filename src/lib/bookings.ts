import { db } from './db';
import { hash, token } from './security';
import { slotsForDay, dateInRiga, ZONE } from './calendar';
import { defaultSchedule, type Schedule, type Translations } from './defaults';
import { bookingInput } from './validation';
import { copy } from './i18n';
import { formatInTimeZone } from 'date-fns-tz';
export async function createBooking(raw: unknown) {
  const input = bookingInput.parse(raw);
  const cancelToken = token();
  const result = await db.$transaction(
    async (tx) => {
      // The same advisory lock serializes bookings and schedule/status changes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      const service = await tx.service.findUnique({
        where: { id: input.serviceId },
      });
      if (!service?.active) throw new Error('INVALID');
      const setting = await tx.setting.findUnique({
        where: { key: 'schedule' },
      });
      const rules = {
        ...defaultSchedule,
        ...((setting?.value as object) ?? {}),
      } as Schedule;
      const start = new Date(input.start),
        end = new Date(start.getTime() + service.duration * 60000);
      const busy = await tx.booking.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          start: { lt: end },
          end: { gt: start },
        },
        select: { start: true, end: true },
      });
      if (
        !slotsForDay(dateInRiga(start), service.duration, rules, busy).includes(
          start.toISOString(),
        )
      )
        throw new Error('CONFLICT');
      const { consent, website, ...data } = input;
      void consent;
      void website;
      const booking = await tx.booking.create({
        data: { ...data, start, end, tokenHash: hash(cancelToken) },
      });
      const customCopy = await tx.setting.findUnique({
        where: { key: `content.${input.locale}` },
      });
      const c = {
        ...copy[input.locale],
        ...((customCopy?.value as object) ?? {}),
      };
      const title = (service.translations as Translations)[input.locale].name;
      const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/${input.locale}/cancel?token=${cancelToken}`;
      const text = `TaxSolutions\n${c.success}\n${title}\n${formatInTimeZone(start, ZONE, 'dd.MM.yyyy HH:mm')} (Europe/Riga)\n${c.cancel}: ${url}`;
      await tx.outbox.create({
        data: { to: input.email, subject: `TaxSolutions — ${c.nav[3]}`, text },
      });
      return booking;
    },
    { timeout: 15000 },
  );
  return { id: result.id, cancelToken };
}
export async function cancelBooking(cancelToken: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
    const booking = await tx.booking.findUnique({
      where: { tokenHash: hash(cancelToken) },
    });
    if (!booking) throw new Error('INVALID');
    if (booking.status === 'CANCELLED') return;
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });
    await tx.outbox.create({
      data: {
        to: booking.email,
        subject: 'TaxSolutions',
        text: copy[booking.locale as keyof typeof copy].cancelled,
      },
    });
  });
}
