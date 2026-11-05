import { sameOrigin, rateLimit } from '@/lib/security';
import { failure, json } from '@/lib/http';
import { contactInput } from '@/lib/validation';
import { contacts } from '@/lib/content';
import { db } from '@/lib/db';
import { notify } from '@/lib/v2/notifications';
import { audit } from '@/lib/v2/audit';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('contact', 15);
    const v = contactInput.parse(await json(req));
    const c = await contacts();
    await db.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: {
          name: v.name,
          email: v.email.toLowerCase(),
          message: v.comment,
          locale: v.locale,
        },
      });
      if (c.email)
        await notify(tx, {
          to: c.email,
          locale: 'lv',
          kind: 'requested',
          id: inquiry.id,
          dedup: `inquiry:${inquiry.id}`,
          link: `${process.env.APP_URL}/workspace`,
        });
      await audit(tx, null, 'INQUIRY_CREATE', 'Inquiry', inquiry.id);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
