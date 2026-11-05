import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('.pages-build/out');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const files = await walk(root),
  html = files.filter((f) => f.endsWith('.html'));
let links = 0;
for (const file of html) {
  const text = await readFile(file, 'utf8');
  assert(
    !/<form\b|<input\b|<textarea\b/i.test(text),
    `Live form leaked into ${file}`,
  );
  for (const tag of text.matchAll(/<(?:a|link|script|img)\b[^>]*>/g)) {
    const attr = tag[0].match(/\b(?:href|src)="([^"]+)"/);
    if (!attr) continue;
    const value = attr[1].replaceAll('&amp;', '&');
    if (/^(data:|mailto:|tel:)/.test(value)) continue;
    const relative = path
      .relative(root, file)
      .replaceAll(path.sep, '/')
      .replace(/index\.html$/, '');
    const url = new URL(
      value,
      `https://a-zcare.github.io/taxsolutions/${relative}`,
    );
    if (url.origin !== 'https://a-zcare.github.io') continue;
    assert(
      url.pathname.startsWith('/taxsolutions/'),
      `Unprefixed URL ${value} in ${file}`,
    );
    let dest = path.join(
      root,
      decodeURIComponent(url.pathname.slice('/taxsolutions/'.length)),
    );
    let found = await stat(dest).catch(() => null);
    if (found?.isDirectory()) {
      dest = path.join(dest, 'index.html');
      found = await stat(dest).catch(() => null);
    }
    assert(found?.isFile(), `Missing target ${value} in ${file}`);
    if (url.hash && dest.endsWith('.html')) {
      const target = await readFile(dest, 'utf8');
      assert(
        target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
        `Missing anchor ${value}`,
      );
    }
    links++;
  }
}
for (const locale of ['lv', 'en', 'ru']) {
  for (const doc of ['', 'privacy/', 'terms/', 'legal/']) {
    const text = await readFile(
      path.join(root, locale, doc, 'index.html'),
      'utf8',
    );
    assert(
      text.includes(`<html lang="${locale}"`),
      `Wrong HTML language: ${locale}/${doc}`,
    );
    assert(
      text.includes('id="taxsolutions-theme-init"') &&
        text.indexOf('id="taxsolutions-theme-init"') < text.indexOf('<body'),
      `Theme must initialize before body: ${locale}/${doc}`,
    );
    assert(
      text.includes('class="theme-toggle"'),
      `Theme toggle missing: ${locale}/${doc}`,
    );
    assert(
      text.includes('demo-banner'),
      `Demo notice missing: ${locale}/${doc}`,
    );
  }
}
assert(
  files.every((f) => !path.relative(root, f).startsWith('api/')),
  'API routes must not be exported',
);
assert(html.length >= 14, 'Missing static pages');
assert(
  (await readFile(path.join(root, 'sitemap.xml'), 'utf8')).includes(
    'https://a-zcare.github.io/taxsolutions/ru/legal/',
  ),
);
console.log(
  `Static Pages checks passed: ${html.length} HTML files, ${links} local links/resources, LV/EN/RU and legal pages; no data-collection forms or API routes.`,
);
