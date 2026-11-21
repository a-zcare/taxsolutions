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

  // Keep OCR and previews real. Stub only the optional local model boundary.
  await page.route('**/api/workspace/document-ai?*', async (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'preview') return route.continue();
    if (action === 'review') {
      const header = route.request().headers()['x-document-fields'];
      const fields = JSON.parse(
        Buffer.from(header, 'base64').toString('utf8'),
      ) as { label: string }[];
      return route.fulfill({
        json: {
          values: fields.map(({ label }) =>
            label === 'Supplier' ? 'SIA Example' : null,
          ),
        },
      });
    }
    const response = await route.fetch();
    return route.fulfill({
      response,
      json: { ...(await response.json()), reviewEnabled: true },
    });
  });

  const imagePage = await page.context().newPage();
  await imagePage.setContent(
    '<main style="background:#fff;color:#000;font:36px Arial;padding:40px;width:640px">' +
      'Rēķins 2026-100<br>Сумма к оплате 42 EUR<br>Invoice total 42 EUR</main>',
  );
  const image = await imagePage.locator('main').screenshot();
  await imagePage.setContent(
    '<h1>Contract</h1><p>Contract no. 784</p><p>Date: 21.11.2026</p>',
  );
  const pdf = await imagePage.pdf();
  await imagePage.close();
  await page.getByLabel(/Document \(up to/).setInputFiles([
    { name: 'invoice.png', mimeType: 'image/png', buffer: image },
    { name: 'contract.pdf', mimeType: 'application/pdf', buffer: pdf },
  ]);
  await page.getByRole('button', { name: 'Extract text' }).click();
  const output = page.getByRole('textbox', { name: 'Page 1 · OCR' });
  await expect(output).toHaveValue(/Invoice total 42 EUR/i, { timeout: 25000 });
  const fileList = page.getByRole('region', { name: 'Files' });
  const invoice = fileList.getByRole('button', { name: /invoice.png/ });
  const contract = fileList.getByRole('button', { name: /contract.pdf/ });
  await expect(invoice).toHaveAttribute('aria-current', 'true');
  await expect(
    page.getByRole('img', { name: 'invoice.png · Page 1' }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Document number', exact: true })
    .fill('FIXED-100');
  const supplier = page.getByRole('textbox', { name: 'Supplier' });
  await expect(page.getByText('Ollama suggestion · SIA Example')).toBeVisible();
  await expect(supplier).toHaveValue('');
  await page.getByRole('button', { name: 'Use suggestion' }).click();
  await expect(supplier).toHaveValue('SIA Example');
  await contract.click();
  await expect(contract).toHaveAttribute('aria-current', 'true');
  await expect(
    page.getByRole('img', { name: 'contract.pdf · Page 1' }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Document number', exact: true }),
  ).toHaveValue('784');

  await page.getByText('Field settings', { exact: true }).click();
  await page
    .getByLabel('Document type', { exact: true })
    .first()
    .selectOption('contract');
  await page.getByRole('checkbox', { name: 'Total amount' }).uncheck();
  await expect(page.getByRole('textbox', { name: 'Total amount' })).toHaveCount(
    0,
  );
  await invoice.click();
  await expect(page.getByRole('textbox', { name: 'Total amount' })).toHaveValue(
    '42 EUR',
  );
  await expect(
    page.getByRole('textbox', { name: 'Document number', exact: true }),
  ).toHaveValue('FIXED-100');

  await page.getByText('Field settings', { exact: true }).click();
  await page.getByText('Fields for this file', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Total amount' }).uncheck();
  await expect(page.getByRole('textbox', { name: 'Total amount' })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: 'Use document type settings' })
    .click();
  await expect(page.getByRole('textbox', { name: 'Total amount' })).toHaveValue(
    '42 EUR',
  );
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Document AI', exact: true }).click();
  await expect(invoice).toHaveAttribute('aria-current', 'true');
  await expect(supplier).toHaveValue('SIA Example');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download text (.txt)' }).click();
  expect((await download).suggestedFilename()).toBe('taxsolutions-ocr.txt');
});
