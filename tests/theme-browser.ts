import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
export function themeTests(prefix = '') {
  const home = (locale: string) => `${prefix}/${locale}${prefix ? '/' : ''}`;
  const legal = (locale: string) =>
    `${prefix}/${locale}/privacy${prefix ? '/' : ''}`;
  test('light default, instant toggle, persistence and language navigation', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(home('en'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await page.evaluate(() => (document.body.dataset.sameDocument = 'yes'));
    const url = page.url();
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(page.url()).toBe(url);
    await expect(page.locator('body')).toHaveAttribute(
      'data-same-document',
      'yes',
    );
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(11, 18, 32)',
    );
    await expect(page.locator('.theme-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await page.evaluate(() => localStorage.getItem('taxsolutions-theme')),
    ).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('link', { name: 'RU', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto(legal('ru'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    expect(new URL(page.url()).pathname).toBe(legal('ru'));
  });
  test('saved dark theme is applied before body and without hydration', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('taxsolutions-theme', 'dark');
      const observer = new MutationObserver(() => {
        if (document.body) {
          (window as unknown as { themeAtBody?: string }).themeAtBody =
            document.documentElement.dataset.theme;
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.route(/\/_next\/static\/.*\.js/, (route) => route.abort());
    await page.goto(home('en'), { waitUntil: 'domcontentloaded' });
    expect(
      await page.evaluate(
        () => (window as unknown as { themeAtBody?: string }).themeAtBody,
      ),
    ).toBe('dark');
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(11, 18, 32)',
    );
  });
  test('both themes remain accessible and responsive in LV EN RU', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    for (const locale of ['lv', 'en', 'ru']) {
      await page.goto(home(locale));
      for (const theme of ['light', 'dark']) {
        const current = await page.locator('html').getAttribute('data-theme');
        if (current !== theme) await page.locator('.theme-toggle').click();
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        for (const width of [320, 375, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${locale} ${theme} ${width}`,
          ).toBe(true);
          await expect(page.locator('.theme-toggle')).toBeVisible();
        }
        await page.locator('.faq-item summary').first().click();
        if (locale === 'en') {
          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(result.violations).toEqual([]);
        }
      }
    }
    expect(errors).toEqual([]);
  });
  test('theme still toggles when local storage is blocked', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Blocked', 'SecurityError');
        },
      }),
    );
    await page.goto(home('en'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
  test('PWA manifest, safe service-worker scope and public-only offline cache', async ({ page, context }) => {
    await page.goto(home('en'));
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe(`${prefix}/manifest.webmanifest`);
    const manifestResponse = await page.request.get(manifestHref!);
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('Tax Solutions');
    expect(manifest.start_url).toBe('./lv/');
    for (const icon of manifest.icons) {
      expect((await page.request.get(`${prefix}/${icon.src.replace(/^\.\//, '')}`)).ok()).toBe(true);
    }
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const cacheUrls = await page.evaluate(async () => {
      const keys = await caches.keys();
      const requests = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()));
      return requests.flat().map((request) => new URL(request.url).pathname);
    });
    expect(cacheUrls.length).toBeGreaterThan(0);
    expect(cacheUrls.some((url) => /\/(admin|workspace|api)(\/|$)/.test(url))).toBe(false);
    await context.setOffline(true);
    await page.goto(`${prefix}/ru/`);
    await expect(page.locator('html')).toContainText('Нет подключения к интернету');
    await context.setOffline(false);
  });
}
