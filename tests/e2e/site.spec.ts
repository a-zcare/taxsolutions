import { fillTestMfa } from './auth-helper';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('all languages, legal pages, metadata and language switching', async ({
  page,
}) => {
  for (const [locale, heading] of [
    ['lv', 'Mazāk rūpju.'],
    ['en', 'Less complexity.'],
    ['ru', 'Меньше сложностей.'],
  ]) {
    await page.goto(`/${locale}`);
    await expect(page.locator('h1')).toContainText(heading);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `http://localhost:3000/${locale}`,
    );
    for (const doc of ['privacy', 'terms', 'legal']) {
      const r = await page.goto(`/${locale}/${doc}`);
      expect(r?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
    }
  }
  await page.goto('/lv');
  await page.getByRole('link', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL('/en');
});
test('calendar, real booking, conflict and cancellation', async ({
  page,
  request,
}) => {
  await page.goto('/en#booking');
  const cal = page.locator('.calendar');
  await expect(
    cal.locator('button[aria-label^="20"]:enabled').first(),
  ).toBeVisible();
  await cal.locator('button[aria-label^="20"]:enabled').first().click();
  await page.locator('.time-slots button').first().click();
  await page.locator('.booking-form input[name=name]').fill('Browser Test');
  await page
    .locator('.booking-form input[name=email]')
    .fill('browser@example.invalid');
  await page.locator('.booking-form input[name=phone]').fill('+371 20000000');
  await page.locator('.booking-form input[name=consent]').check();
  const submitted = page.waitForRequest(
    (r) => r.url().endsWith('/api/bookings') && r.method() === 'POST',
  );
  await page.locator('.submit-button').click();
  const payload = (await submitted).postDataJSON();
  await expect(page.locator('.success-box')).toContainText('Appointment saved');
  expect(
    (
      await request.post('/api/bookings', {
        headers: { origin: 'http://localhost:3000' },
        data: payload,
      })
    ).status(),
  ).toBe(409);
  const exportLink = await page
    .locator('.calendar-export a')
    .first()
    .getAttribute('href');
  const ics = await request.get(exportLink!);
  expect(ics.status()).toBe(200);
  expect(await ics.text()).toContain('BEGIN:VEVENT');
  const cancel = page.locator('.success-box a[href*="/cancel?"]');
  await cancel.click();
  await page
    .getByRole('button', { name: 'Cancel appointment', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Appointment cancelled');
  const blocked = await request.post('/api/bookings', {
    headers: { origin: 'https://wrong.invalid' },
    data: {},
  });
  expect(blocked.status()).toBe(403);
});
test('admin API authorization and sign in', async ({ page, request }) => {
  expect((await request.get('/api/admin')).status()).toBe(401);
  await page.goto('/admin');
  await page
    .getByRole('combobox', { name: 'Language / Valoda / Язык' })
    .selectOption('en');
  await page
    .getByLabel('Email', { exact: true })
    .fill(process.env.ADMIN_EMAIL ?? 'admin@example.invalid');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD ?? '');
  await fillTestMfa(page);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Business overview' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'schedule', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Availability · Europe/Riga' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Administration' }),
  ).toBeVisible();
});
test('desktop accessibility and mobile overflow', async ({ page }) => {
  await page.goto('/en');
  await expect(
    page.locator('.calendar button[aria-label^="20"]:enabled').first(),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('h1')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('admin edits prices, holidays, contacts and localized content', async ({
  page,
}) => {
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
  const state = await (await page.request.get('/api/admin')).json();
  const service = state.services.find((s: { id: string }) => s.id === 'tax');
  const settings = Object.fromEntries(
    state.settings.map((s: { key: string; value: unknown }) => [
      s.key,
      s.value,
    ]),
  );
  const post = async (action: string, data: unknown) => {
    const r = await page.request.post('/api/admin', {
      headers: { origin: 'http://localhost:3000' },
      data: { action, data },
    });
    expect(r.status()).toBe(200);
  };
  try {
    await post('service', { ...service, price: 7700 });
    await page.goto('/en#pricing');
    await expect(
      page.locator('.price-card').filter({ hasText: 'Tax consultations' }),
    ).toContainText('€77');
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await post('schedule', {
      ...settings.schedule,
      closedDates: [...settings.schedule.closedDates, date],
    });
    const closed = await (
      await page.request.get(`/api/availability?date=${date}&serviceId=tax`)
    ).json();
    expect(closed.slots).toEqual([]);
    await post('contacts', {
      ...settings.contacts,
      email: 'contact-test@example.invalid',
    });
    await page.goto('/en#contact');
    await page.reload();
    await page
      .locator('.contact-form input[name=name]')
      .fill('Contact Browser Test');
    await page
      .locator('.contact-form input[name=email]')
      .fill('browser@example.invalid');
    await page
      .locator('.contact-form textarea')
      .fill('Please arrange a consultation for my business.');
    await page.locator('.contact-form input[type=checkbox]').check();
    await page.locator('.contact-form button').click();
    await expect(page.locator('.contact-form [role=status]')).toContainText(
      'Message received',
    );
    await post('content', {
      locale: 'en',
      value: {
        ...(settings['content.en'] ?? {}),
        footer: 'Verified browser test footer',
      },
    });
    await page.goto('/en');
    await page.reload();
    await expect(page.locator('.footer-top')).toContainText(
      'Verified browser test footer',
    );
  } finally {
    await post('service', service);
    await post('schedule', settings.schedule);
    await post('contacts', settings.contacts);
    await post('content', {
      locale: 'en',
      value: settings['content.en'] ?? {},
    });
  }
});
