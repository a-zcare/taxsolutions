import { sameOrigin, rateLimit } from '@/lib/security';
import { failure, json } from '@/lib/http';
import { rescheduleBooking } from '@/lib/bookings';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('reschedule', 20);
    const v = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        start: z.iso.datetime(),
      })
      .parse(await json(req));
    return Response.json(await rescheduleBooking(v), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
