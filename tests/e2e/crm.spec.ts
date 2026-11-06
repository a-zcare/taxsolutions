import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fillTestMfa } from './auth-helper';
async function login(page: import('@playwright/test').Page) {
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
}
test('CRM real KPI, day/week/month, appointment management and preserved editors', async ({
  page,
}) => {
  await login(page);
  await expect(
    page.locator('.workspace-metrics strong').first(),
  ).not.toHaveText('—');
  const dashboard = await (
    await page.request.get('/api/workspace?view=dashboard')
  ).json();
  await expect(page.locator('.workspace-metrics strong').first()).toHaveText(
    String(dashboard.newBookings),
  );
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.locator('.theme-toggle').click();
    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(a11y.violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('.crm-period input[type=date]').fill('2027-01-04');
  await page.getByRole('button', { name: 'day', exact: true }).click();
  await expect(page.locator('.crm-calendar-grid > section')).toHaveCount(1);
  const event = page
    .locator('.crm-event')
    .filter({ hasText: 'Synthetic calendar client' })
    .first();
  await expect(event).toBeVisible();
  await event.click();
  await expect(
    page.getByRole('region', { name: 'Appointment details' }),
  ).toContainText('Synthetic note');
  await expect(
    page.getByRole('region', { name: 'Appointment details' }),
  ).toContainText('Europe/Riga');
  const currentStatus = await page
    .getByRole('combobox', { name: 'Event status', exact: true })
    .inputValue();
  if (currentStatus === 'PENDING') {
    await page
      .getByRole('combobox', { name: 'Event status', exact: true })
      .selectOption('CONFIRMED');
    await expect(
      page.getByRole('combobox', { name: 'Event status', exact: true }),
    ).toHaveValue('CONFIRMED');
  }
  await page.getByRole('button', { name: 'week', exact: true }).click();
  await expect(page.locator('.crm-calendar-grid > section')).toHaveCount(7);
  await page.getByRole('button', { name: 'month', exact: true }).click();
  await expect(page.locator('.crm-calendar-grid > section')).toHaveCount(42);
  await page.getByRole('button', { name: 'services', exact: true }).click();
  await expect(page.locator('.crm-service').first()).toBeVisible();
  await expect(page.locator('.crm-service').first()).not.toHaveAttribute(
    'open',
  );
  await page.locator('.crm-service summary').first().click();
  await expect(
    page.getByRole('button', { name: 'Save service', exact: true }).first(),
  ).toBeVisible();
  for (const [nav, title] of [
    ['schedule', 'Availability · Europe/Riga'],
    ['contacts', 'Contact & company details'],
    ['content', 'Website copy'],
  ]) {
    await page.getByRole('button', { name: nav, exact: true }).click();
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
  }
});
test('mobile sidebar, locales, loading failure retry and calendar navigation', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Open navigation', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open navigation', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click();
  await page.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Clients', exact: true }),
  ).toBeVisible();
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `CRM viewport width ${width}`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/workspace?view=calendar**', (route) =>
    route.fulfill({ status: 503, json: { error: 'SERVER_ERROR' } }),
  );
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.crm-feedback[role=alert]')).toContainText(
    'Request failed',
  );
  await page.unroute('**/api/workspace?view=calendar**');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.crm-calendar-grid')).toBeVisible();
  for (const locale of ['lv', 'ru', 'en']) {
    await page
      .getByRole('combobox', { name: 'Language / Valoda / Язык' })
      .selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('.crm-calendar-grid')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: 'test-results/crm-mobile.png',
    fullPage: true,
  });
});
