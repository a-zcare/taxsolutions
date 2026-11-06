import { NextResponse } from 'next/server';
import { availableSlots } from '@/lib/v2/availability';
import { failure } from '@/lib/http';
import { rateLimit } from '@/lib/security';
import { z } from 'zod';
export async function GET(req: Request) {
  try {
    await rateLimit('availability', 600);
    const u = new URL(req.url),
      date = z.iso.date().parse(u.searchParams.get('date')),
      serviceId = z
        .string()
        .min(1)
        .max(80)
        .parse(u.searchParams.get('serviceId')),
      staffId = z
        .uuid()
        .optional()
        .parse(u.searchParams.get('staffId') || undefined);
    return NextResponse.json(
      { slots: await availableSlots(date, serviceId, staffId) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
