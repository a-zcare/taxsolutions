import { db } from '@/lib/db';
import { hash, rateLimit } from '@/lib/security';
import { failure } from '@/lib/http';
import { calendarFile } from '@/lib/calendar-export';
import type { Translations } from '@/lib/defaults';
export async function GET(req: Request) {
  try {
    await rateLimit('calendar-export', 100);
    const token = new URL(req.url).searchParams.get('token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) throw Error('INVALID');
    const booking = await db.booking.findUnique({
      where: { tokenHash: hash(token) },
      include: { service: true },
    });
    if (!booking || booking.status === 'CANCELLED') throw Error('INVALID');
    return new Response(
      calendarFile({
        ...booking,
        title: (booking.service.translations as Translations)[booking.locale]
          .name,
      }),
      {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="taxsolutions.ics"',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
