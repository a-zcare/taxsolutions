import type { Page } from '@playwright/test';
import { db } from '../../src/lib/db';
import { requireTestDatabase } from '../fixtures';
import { totp } from '../../src/lib/v2/crypto';
export async function fillTestMfa(page: Page) {
  requireTestDatabase();
  await db.staff.update({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@example.invalid' },
    data: { lastTotpCounter: -1n },
  });
  await page
    .getByLabel('Authenticator code', { exact: true })
    .fill(totp(process.env.TEST_TOTP_SECRET!));
}
