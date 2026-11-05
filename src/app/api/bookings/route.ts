import { NextResponse } from 'next/server';
import { sameOrigin, rateLimit } from '@/lib/security';
import { createBooking } from '@/lib/bookings';
import { failure, json } from '@/lib/http';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('booking', 20);
    const result = await createBooking(await json(req));
    return NextResponse.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
