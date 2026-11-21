import { test, expect } from '@playwright/test';
import { fillTestMfa } from './auth-helper';

test('Document AI protects uploads and recognizes a synthetic invoice', async ({
  page,
  request,
}) => {
  const headers = { Origin: 'http://localhost:3000' };
  const path = '/api/workspace/document-ai';
  expect((await request.post(path, { headers, data: 'test' })).status()).toBe(
    401,
  );

  await page.goto('/admin');
  await page
    .getByRole('combobox', { name: 'Language / Valoda / Язык' })
    .selectOption('en');
  await fillTestMfa(page);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await page.getByRole('button', { name: 'Document AI' }).click();
  await expect(
    page.getByRole('heading', { name: 'Document AI' }),
  ).toBeVisible();

  expect((await page.request.post(path, { data: 'test' })).status()).toBe(403);
  expect(
    (await page.request.post(path, { headers, data: 'test' })).status(),
  ).toBe(415);

  const imagePage = await page.context().newPage();
  await imagePage.setContent(
    '<main style="background:#fff;color:#000;font:36px Arial;padding:40px;width:640px">' +
      'Rēķins 2026-100<br>Сумма к оплате 42 EUR<br>Invoice total 42 EUR</main>',
  );
  const image = await imagePage.locator('main').screenshot();
  await imagePage.close();
  await page.getByLabel(/Document \(up to/).setInputFiles({
    name: 'invoice.png',
    mimeType: 'image/png',
    buffer: image,
  });
  await page.getByRole('button', { name: 'Extract text' }).click();
  const output = page.getByRole('textbox', { name: 'Page 1 · OCR' });
  await expect(output).toHaveValue(/Invoice total 42 EUR/i, { timeout: 25000 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download text (.txt)' }).click();
  expect((await download).suggestedFilename()).toBe('taxsolutions-ocr.txt');
});
