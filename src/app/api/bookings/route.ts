import { NextResponse } from 'next/server';
import { sameOrigin, rateLimit } from '@/lib/security';
import { createBooking } from '@/lib/bookings';
import { failure, json } from '@/lib/http';
import { bookingInput } from '@/lib/validation';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('booking', 20);
    const input = bookingInput.parse(await json(req));
    await rateLimit('booking-email', 5, input.email.toLowerCase());
    const result = await createBooking(input);
    return NextResponse.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
