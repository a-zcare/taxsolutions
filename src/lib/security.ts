import { db } from './db';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('hex');
function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32 || s.startsWith('replace-'))
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(s);
}
export async function session() {
  const raw = (await cookies()).get('tax-session')?.value;
  if (!raw) return false;
  try {
    const { payload } = await jwtVerify(raw, key(), {
      issuer: 'taxsolutions',
      audience: 'admin',
    });
    return payload.sub === 'admin';
  } catch {
    return false;
  }
}
export async function loginSession() {
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuer('taxsolutions')
    .setAudience('admin')
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key());
  (await cookies()).set('tax-session', value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 28800,
  });
}
export async function requireAdmin() {
  if (!(await session())) throw new Error('UNAUTHORIZED');
}
export async function sameOrigin() {
  const h = await headers();
  if (
    h.get('origin') !==
    new URL(process.env.APP_URL ?? 'http://localhost:3000').origin
  )
    throw new Error('ORIGIN');
}
export async function rateLimit(bucket: string, limit: number) {
  const h = await headers();
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing session secret');
  // Only trust an IP header when your reverse proxy overwrites it. Otherwise use a global bucket.
  const ip =
    process.env.TRUST_PROXY === 'true'
      ? (h.get('x-real-ip') ?? 'unknown')
      : 'global';
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
