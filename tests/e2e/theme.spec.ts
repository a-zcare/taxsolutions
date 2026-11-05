import { test, expect } from '@playwright/test';
import { themeTests } from '../theme-browser';
themeTests();
test('calendar selection and form fields survive theme changes', async ({
  page,
}) => {
  await page.goto('/en#booking');
  await page
    .locator('.calendar button[aria-label^="20"]:enabled')
    .first()
    .click();
  await page.locator('.time-slots button').first().click();
  await page.locator('.booking-form input[name=name]').fill('Theme check');
  const day = await page
    .locator('.calendar button[aria-pressed=true]')
    .getAttribute('aria-label');
  const time = await page
    .locator('.time-slots button[aria-pressed=true]')
    .innerText();
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.locator('.calendar button[aria-pressed=true]'),
  ).toHaveAttribute('aria-label', day!);
  await expect(
    page.locator('.time-slots button[aria-pressed=true]'),
  ).toHaveText(time);
  await expect(page.locator('.booking-form input[name=name]')).toHaveValue(
    'Theme check',
  );
  await expect(page.locator('.booking-form input[name=name]')).toHaveCSS(
    'background-color',
    'rgb(14, 25, 43)',
  );
});
test('admin login and management honor dark appearance', async ({ page }) => {
  await page.goto('/admin');
  await page
    .getByRole('combobox', { name: 'Language / Valoda / Язык' })
    .selectOption('en');
  await page.locator('.theme-toggle').click();
  await expect(page.locator('input[type=email]')).toHaveCSS(
    'background-color',
    'rgb(14, 25, 43)',
  );
  await page
    .getByLabel('Email', { exact: true })
    .fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Business overview' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.admin-card').first()).toHaveCSS(
    'background-color',
    'rgb(18, 30, 49)',
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
});
