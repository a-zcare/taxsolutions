import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { schedule } from '@/lib/content';
import { slotsForDay } from '@/lib/calendar';
import { failure } from '@/lib/http';
import { rateLimit } from '@/lib/security';
export async function GET(req: Request) {
  try {
    await rateLimit('calendar', 180);
    const url = new URL(req.url),
      month = url.searchParams.get('month') ?? '',
      serviceId = url.searchParams.get('serviceId') ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('INVALID');
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const [service, rules, busy] = await Promise.all([
      db.service.findUnique({ where: { id: serviceId } }),
      schedule(),
      db.booking.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          start: { lt: new Date(end.getTime() + 86400000) },
          end: { gt: new Date(start.getTime() - 86400000) },
        },
        select: { start: true, end: true },
      }),
    ]);
    if (!service?.active) throw new Error('INVALID');
    const available: string[] = [];
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      if (slotsForDay(date, service.duration, rules, busy).length)
        available.push(date);
    }
    return NextResponse.json(
      { available },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
