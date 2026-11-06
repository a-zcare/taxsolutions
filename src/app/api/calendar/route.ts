import { NextResponse } from 'next/server';
import { availableSlots } from '@/lib/v2/availability';
import { failure } from '@/lib/http';
import { rateLimit } from '@/lib/security';
import { z } from 'zod';
export async function GET(req: Request) {
  try {
    await rateLimit('calendar', 180);
    const u = new URL(req.url),
      month = z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .parse(u.searchParams.get('month')),
      serviceId = z
        .string()
        .min(1)
        .max(80)
        .parse(u.searchParams.get('serviceId')),
      staffId = z
        .uuid()
        .optional()
        .parse(u.searchParams.get('staffId') || undefined);
    const first = new Date(`${month}-01T12:00Z`),
      end = new Date(first);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const available: string[] = [];
    for (let d = new Date(first); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      if ((await availableSlots(date, serviceId, staffId)).length)
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
