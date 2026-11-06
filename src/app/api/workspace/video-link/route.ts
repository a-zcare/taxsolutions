import { db } from '@/lib/db';
import { requireActor } from '@/lib/security';
import { assertAssigned } from '@/lib/v2/policy';
import { unseal } from '@/lib/v2/crypto';
import { audit } from '@/lib/v2/audit';
import { failure } from '@/lib/http';
import { z } from 'zod';
export async function GET(req: Request) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse(new URL(req.url).searchParams.get('bookingId'));
    const b = await db.booking.findUnique({
      where: { id },
      include: { meeting: true },
    });
    if (!b) throw Error('NOT_FOUND');
    assertAssigned(actor, b.staffId);
    if (b.meeting?.status !== 'READY' || !b.meeting.joinUrlCiphertext)
      throw Error('NOT_FOUND');
    const url = unseal(b.meeting.joinUrlCiphertext, `video:${b.id}`);
    await db.$transaction((tx) =>
      audit(tx, actor, 'VIDEO_LINK_VIEW', 'Booking', id),
    );
    return Response.json(
      { url },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
