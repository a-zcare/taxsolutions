import { NextResponse } from 'next/server';
import { sameOrigin, rateLimit } from '@/lib/security';
import { failure, json } from '@/lib/http';
import { contactInput } from '@/lib/validation';
import { contacts } from '@/lib/content';
import { db } from '@/lib/db';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('contact', 15);
    const v = contactInput.parse(await json(req));
    const c = await contacts();
    if (!c.email) throw new Error('INVALID');
    await db.outbox.create({
      data: {
        to: c.email,
        subject: 'TaxSolutions — contact',
        text: `${v.name}\n${v.email}\n${v.comment}`,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
