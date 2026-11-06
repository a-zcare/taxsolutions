import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
  name: string; short_name: string; start_url: string; scope: string;
  display: string; icons: { src: string; sizes: string; purpose?: string }[];
};
const serviceWorker = readFileSync('public/sw.js', 'utf8');

function fetchHandler() {
  const listeners = new Map<string, (event: never) => void>();
  const self = {
    location: { origin: 'https://example.test' },
    registration: { scope: 'https://example.test/taxsolutions/' },
    clients: { claim: async () => undefined },
    addEventListener: (name: string, listener: (event: never) => void) => listeners.set(name, listener),
    skipWaiting: () => undefined,
  };
  const cache = { add: async () => undefined, match: async () => undefined, put: async () => undefined };
  runInNewContext(serviceWorker, {
    self, URL,
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async () => new Response('ok'),
  });
  return (url: string, mode = 'navigate', method = 'GET') => {
    let intercepted = false;
    listeners.get('fetch')?.({
      request: { method, mode, url },
      respondWith: () => { intercepted = true; },
    } as never);
    return intercepted;
  };
}

describe('PWA safety and install metadata', () => {
  it('declares a standalone app with valid-sized icons and relative scope', () => {
    expect(manifest.name).toBe('Tax Solutions');
    expect(manifest.short_name).toBe('TaxSolutions');
    expect(manifest.start_url).toBe('./lv/');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(manifest.icons[2].purpose).toBe('maskable');
    for (const icon of manifest.icons) expect(readFileSync(`public/${icon.src.slice(2)}`).byteLength).toBeGreaterThan(100);
  });

  it('never intercepts admin, workspace, API, query-bearing, or external requests', () => {
    const intercepts = fetchHandler();
    expect(intercepts('https://example.test/taxsolutions/admin/')).toBe(false);
    expect(intercepts('https://example.test/taxsolutions/workspace/')).toBe(false);
    expect(intercepts('https://example.test/taxsolutions/api/workspace')).toBe(false);
    expect(intercepts('https://example.test/taxsolutions/lv/?email=user@example.test')).toBe(false);
    expect(intercepts('https://other.test/taxsolutions/lv/')).toBe(false);
  });

  it('uses the public locale allowlist and hashed static assets only', () => {
    const intercepts = fetchHandler();
    expect(intercepts('https://example.test/taxsolutions/lv/')).toBe(true);
    expect(intercepts('https://example.test/taxsolutions/lv')).toBe(true);
    expect(intercepts('https://example.test/taxsolutions/en/')).toBe(true);
    expect(intercepts('https://example.test/taxsolutions/ru/')).toBe(true);
    expect(intercepts('https://example.test/taxsolutions/fr/')).toBe(false);
    expect(intercepts('https://example.test/taxsolutions/_next/static/chunks/app.js', 'no-cors')).toBe(true);
  });
});
