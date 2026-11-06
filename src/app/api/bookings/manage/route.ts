import { db } from '@/lib/db';
import { hash, rateLimit } from '@/lib/security';
import { failure } from '@/lib/http';
export async function GET(req: Request) {
  try {
    await rateLimit('manage-booking', 100);
    const token = new URL(req.url).searchParams.get('token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) throw Error('INVALID');
    const b = await db.booking.findUnique({
      where: { tokenHash: hash(token) },
      select: {
        id: true,
        serviceId: true,
        staffId: true,
        start: true,
        end: true,
        format: true,
        status: true,
      },
    });
    if (!b) throw Error('NOT_FOUND');
    return Response.json(b, {
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
