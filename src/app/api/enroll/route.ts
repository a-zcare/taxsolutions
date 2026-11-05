import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { hash, rateLimit, sameOrigin } from '@/lib/security';
import { failure, json } from '@/lib/http';
import { unseal, verifyTotp } from '@/lib/v2/crypto';
import { audit } from '@/lib/v2/audit';
const capability = z.string().regex(/^[a-f0-9]{64}$/);
export async function GET(req: Request) {
  try {
    await rateLimit('enroll-read', 20);
    const token = capability.parse(new URL(req.url).searchParams.get('token'));
    const staff = await db.staff.findUnique({
      where: { enrolTokenHash: hash(token) },
    });
    if (
      !staff ||
      staff.active ||
      !staff.enrolExpiresAt ||
      staff.enrolExpiresAt < new Date()
    )
      throw Error('NOT_FOUND');
    const secret = unseal(staff.totpCiphertext, `totp:${staff.id}`);
    return Response.json(
      {
        secret,
        uri: `otpauth://totp/TaxSolutions:${encodeURIComponent(staff.email)}?secret=${secret}&issuer=TaxSolutions&algorithm=SHA1&digits=6&period=30`,
      },
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
export async function POST(req: Request) {
  try {
    await sameOrigin();
    await rateLimit('enroll-write', 8);
    const v = z
      .object({
        token: capability,
        password: z.string().min(14).max(200),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(await json(req));
    const passwordHash = await bcrypt.hash(v.password, 12);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(740217)`;
      const staff = await tx.staff.findUnique({
        where: { enrolTokenHash: hash(v.token) },
      });
      if (
        !staff ||
        staff.active ||
        !staff.enrolExpiresAt ||
        staff.enrolExpiresAt < new Date()
      )
        throw Error('NOT_FOUND');
      const counter = verifyTotp(
        unseal(staff.totpCiphertext, `totp:${staff.id}`),
        v.code,
        -1n,
      );
      if (counter === null) throw Error('UNAUTHORIZED');
      await tx.staff.update({
        where: { id: staff.id },
        data: {
          passwordHash,
          active: true,
          lastTotpCounter: counter,
          enrolTokenHash: null,
          enrolExpiresAt: null,
        },
      });
      await audit(tx, null, 'MFA_ENROLLED', 'Staff', staff.id);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
