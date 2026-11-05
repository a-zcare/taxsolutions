import { NextResponse } from 'next/server';
import { sameOrigin, rateLimit, loginSession } from '@/lib/security';
import { authenticate } from '@/lib/v2/auth';
import { failure, json } from '@/lib/http';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('admin-login', 12);
    const v = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(200),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(await json(req));
    await rateLimit('admin-login-account', 8, v.email.toLowerCase());
    const user = await authenticate(v.email, v.password, v.code);
    await loginSession(user.id);
    return NextResponse.json({ ok: true, role: user.role });
  } catch (e) {
    return failure(e);
  }
}
