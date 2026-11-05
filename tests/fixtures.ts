import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { seal } from '../src/lib/v2/crypto';
export function requireTestDatabase() {
  const raw = process.env.DATABASE_URL ?? '';
  const u = new URL(raw);
  if (
    process.env.APP_ENV !== 'test' ||
    !u.pathname.includes('taxsolutions_test') ||
    !['localhost', '127.0.0.1', 'db', 'postgres'].includes(u.hostname)
  )
    throw Error(
      'Synthetic fixtures require APP_ENV=test and an isolated local taxsolutions_test database',
    );
}
export async function prepareTestOwner() {
  requireTestDatabase();
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.invalid',
    password = process.env.TEST_ADMIN_PASSWORD,
    secret = process.env.TEST_TOTP_SECRET;
  if (!password || !secret) throw Error('Test credentials required');
  const old = await db.staff.findUnique({ where: { email } }),
    id = old?.id ?? randomUUID();
  await db.staff.upsert({
    where: { email },
    create: {
      id,
      email,
      name: 'Synthetic Test Owner',
      role: 'OWNER',
      passwordHash: await bcrypt.hash(password, 12),
      totpCiphertext: seal(secret, `totp:${id}`),
      specializations: ['administration'],
    },
    update: {
      active: true,
      role: 'OWNER',
      passwordHash: await bcrypt.hash(password, 12),
      totpCiphertext: seal(secret, `totp:${id}`),
      lastTotpCounter: -1n,
    },
  });
  return id;
}
