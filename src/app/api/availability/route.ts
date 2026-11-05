import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { schedule } from '@/lib/content';
import { slotsForDay } from '@/lib/calendar';
import { failure } from '@/lib/http';
import { rateLimit } from '@/lib/security';
export async function GET(req: Request) {
  try {
    await rateLimit('availability', 600);
    const url = new URL(req.url),
      date = url.searchParams.get('date') ?? '',
      id = url.searchParams.get('serviceId') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID');
    const service = await db.service.findUnique({ where: { id } });
    if (!service?.active) throw new Error('INVALID');
    const range = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(range.getTime())) throw new Error('INVALID');
    const [rules, busy] = await Promise.all([
      schedule(),
      db.booking.findMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          start: {
            gte: new Date(range.getTime() - 86400000),
            lt: new Date(range.getTime() + 2 * 86400000),
          },
        },
        select: { start: true, end: true },
      }),
    ]);
    return NextResponse.json(
      { slots: slotsForDay(date, service.duration, rules, busy) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
