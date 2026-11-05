import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { themeInitializationScript, THEME_STORAGE_KEY } from '../src/lib/theme';
function bootstrap(saved: string | null, blocked = false) {
  const html = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  runInNewContext(themeInitializationScript, {
    document: { documentElement: html },
    localStorage: {
      getItem: (key: string) => {
        expect(key).toBe(THEME_STORAGE_KEY);
        if (blocked) throw Error('Storage blocked');
        return saved;
      },
    },
  });
  return html;
}
describe('Theme before the first paint', () => {
  it('defaults to light and ignores invalid preferences', () => {
    for (const value of [null, 'system', 'invalid', 'light']) {
      const html = bootstrap(value);
      expect(html.dataset.theme).toBe('light');
      expect(html.style.colorScheme).toBe('light');
    }
  });
  it('restores the explicit dark choice synchronously', () => {
    const html = bootstrap('dark');
    expect(html.dataset.theme).toBe('dark');
    expect(html.style.colorScheme).toBe('dark');
  });
  it('stays usable when storage is unavailable', () =>
    expect(bootstrap(null, true).dataset.theme).toBe('light'));
});
