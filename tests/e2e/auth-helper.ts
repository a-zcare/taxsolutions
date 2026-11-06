import { randomBytes, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { db } from '../../src/lib/db';
import { requireTestDatabase } from '../fixtures';
import { seal, totp } from '../../src/lib/v2/crypto';
/** Give each browser test its own synthetic Owner; production MFA/rate limits stay enabled. */
export async function fillTestMfa(page: Page) {
  requireTestDatabase();
  const id = randomUUID();
  const email = `browser-${id}@example.invalid`;
  const password = `Synthetic-${randomBytes(24).toString('hex')}`;
  const secret = process.env.TEST_TOTP_SECRET;
  if (!secret || !process.env.DATA_ENCRYPTION_KEY)
    throw Error('Isolated browser MFA fixture configuration required');
  await db.staff.create({
    data: {
      id,
      email,
      name: 'Synthetic Browser Owner',
      role: 'OWNER',
      passwordHash: await bcrypt.hash(password, 12),
      totpCiphertext: seal(secret, `totp:${id}`),
      specializations: ['administration'],
      active: true,
    },
  });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByLabel('Authenticator code', { exact: true })
    .fill(totp(secret));
}
