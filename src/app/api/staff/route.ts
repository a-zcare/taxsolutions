import { db } from '@/lib/db';
import { rateLimit } from '@/lib/security';
import { failure } from '@/lib/http';
export async function GET() {
  try {
    await rateLimit('public-staff', 180);
    return Response.json(
      await db.staff.findMany({
        where: { active: true, acceptsBookings: true },
        select: { id: true, name: true, specializations: true },
        orderBy: { name: 'asc' },
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
