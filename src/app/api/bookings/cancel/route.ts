import { NextResponse } from 'next/server';
import { sameOrigin, rateLimit } from '@/lib/security';
import { cancelBooking } from '@/lib/bookings';
import { failure, json } from '@/lib/http';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('cancel', 30);
    const { token } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(await json(req));
    await cancelBooking(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
