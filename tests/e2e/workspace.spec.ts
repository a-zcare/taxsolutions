import { test, expect } from '@playwright/test';
import { fillTestMfa } from './auth-helper';
test('workspace authentication, CSRF, private data and mobile navigation', async ({
  page,
  request,
}) => {
  expect((await request.get('/api/workspace?view=clients')).status()).toBe(401);
  expect(
    (
      await request.post('/api/workspace', {
        headers: { origin: 'https://attacker.invalid' },
        data: { action: 'client', data: {} },
      })
    ).status(),
  ).toBe(403);
  await page.goto('/admin');
  await page
    .getByRole('combobox', { name: 'Language / Valoda / Язык' })
    .selectOption('en');
  await page
    .getByLabel('Email', { exact: true })
    .fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await fillTestMfa(page);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Business overview' }),
  ).toBeVisible();
  await page.goto('/workspace');
  await expect(page.locator('main')).toBeVisible();
  const data = await page.request.get('/api/workspace?view=dashboard');
  expect(data.status()).toBe(200);
  expect(data.headers()['cache-control']).toContain('no-store');
  const json = await data.text();
  expect(json).not.toMatch(
    /passwordHash|totpCiphertext|tokenCiphertext|manageTokenCiphertext/,
  );
  expect(
    (
      await page.request.post('/api/workspace', {
        headers: { origin: 'https://attacker.invalid' },
        data: { action: 'taskStatus', data: {} },
      })
    ).status(),
  ).toBe(403);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/workspace-mobile.png',
    fullPage: true,
  });
});
test('invalid enrollment and disabled OAuth fail safely', async ({
  request,
}) => {
  expect(
    (await request.get('/api/enroll?token=' + 'a'.repeat(64))).status(),
  ).toBe(404);
  const result = await request.get(
    '/api/oauth/google/callback?state=invalid&code=invalid',
    { maxRedirects: 0 },
  );
  expect(result.headers().location).toContain('/workspace?oauth=failed');
  expect(
    (
      await request.post('/api/oauth/google/start', {
        headers: { origin: 'http://localhost:3000' },
      })
    ).status(),
  ).toBe(401);
});
