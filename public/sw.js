/* TaxSolutions SW: cache only immutable public assets and allowlisted public pages. */
const VERSION = 'taxsolutions-public-v1';
const scopeUrl = new URL(self.registration.scope);
const prefix = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
const offlineUrl = new URL('offline.html', scopeUrl).href;
const publicPages = new Set(['lv', 'en', 'ru'].flatMap((locale) => {
  const withSlash = new URL(`${locale}/`, scopeUrl).pathname;
  return [withSlash, withSlash.replace(/\/$/, '')];
}));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.add(offlineUrl)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('taxsolutions-public-') && key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // CRM, authentication, booking APIs, and all unknown dynamic routes are network-only.
  if (url.pathname.includes('/api/') || /\/(admin|workspace)(\/|$)/.test(url.pathname)) return;

  if (url.pathname.startsWith(`${prefix}_next/static/`)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === 'navigate' && publicPages.has(url.pathname) && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(offlineUrl));
      }
    })());
  }
});
