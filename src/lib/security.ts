import { db } from './db';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export async function actor() {
  const raw = (await cookies()).get('tax-session')?.value;
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const row = await db.staffSession.findUnique({
    where: { id: hash(raw) },
    include: {
      staff: {
        select: {
          id: true,
          role: true,
          email: true,
          name: true,
          locale: true,
          active: true,
        },
      },
    },
  });
  if (!row || row.expiresAt < new Date() || !row.staff.active) return null;
  return row.staff;
}
export async function session() {
  return Boolean(await actor());
}
export async function loginSession(staffId: string) {
  const raw = token();
  await db.staffSession.create({
    data: {
      id: hash(raw),
      staffId,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    },
  });
  (await cookies()).set('tax-session', raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 28800,
  });
}
export async function logoutSession() {
  const raw = (await cookies()).get('tax-session')?.value;
  if (raw) await db.staffSession.deleteMany({ where: { id: hash(raw) } });
  (await cookies()).delete('tax-session');
}
export async function requireActor() {
  const staff = await actor();
  if (!staff) throw Error('UNAUTHORIZED');
  return staff;
}
export async function requireAdmin() {
  const staff = await requireActor();
  if (staff.role === 'ACCOUNTANT') throw Error('FORBIDDEN');
  return staff;
}
export async function sameOrigin() {
  const h = await headers();
  if (
    h.get('origin') !==
    new URL(process.env.APP_URL ?? 'http://localhost:3000').origin
  )
    throw new Error('ORIGIN');
}
export async function rateLimit(
  bucket: string,
  limit: number,
  subject?: string,
) {
  const h = await headers();
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing session secret');
  // Only trust an IP header when your reverse proxy overwrites it. Otherwise use a global bucket.
  const ip =
    subject ??
    (process.env.TRUST_PROXY === 'true'
      ? (h.get('x-real-ip') ?? 'unknown')
      : 'global');
  const key = hash(secret + bucket + ip);
  const expiresAt = new Date(Date.now() + 15 * 60000);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt"<now() THEN 1 ELSE "RateLimit"."count"+1 END,"expiresAt"=CASE WHEN "RateLimit"."expiresAt"<now() THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > limit) throw new Error('RATE');
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
