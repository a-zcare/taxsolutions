import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sameOrigin, rateLimit, loginSession, safeEqual } from '@/lib/security';
import { failure, json } from '@/lib/http';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('admin-login', 8);
    const v = z
      .object({ email: z.email(), password: z.string().min(1).max(200) })
      .parse(await json(req));
    const hash = process.env.ADMIN_PASSWORD_HASH_B64
      ? Buffer.from(process.env.ADMIN_PASSWORD_HASH_B64, 'base64').toString(
          'utf8',
        )
      : undefined;
    if (!hash || !process.env.ADMIN_EMAIL) throw new Error('UNAUTHORIZED');
    const valid = await bcrypt.compare(v.password, hash);
    if (
      !valid ||
      !safeEqual(v.email.toLowerCase(), process.env.ADMIN_EMAIL.toLowerCase())
    )
      throw new Error('UNAUTHORIZED');
    await loginSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
