import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, '.pages-build');
await rm(target, { recursive: true, force: true });
const put = async (name, value) => {
  const file = path.join(target, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
};
const copy = async (name) => {
  const file = path.join(target, name);
  await mkdir(path.dirname(file), { recursive: true });
  await cp(path.join(root, name), file, { recursive: true });
};
// Only public presentation files are copied. No API, admin authentication,
// database module, proxy, .env, or server-side forms can enter this export.
for (const file of [
  'src/app/globals.css',
  'src/lib/i18n.ts',
  'src/lib/defaults.ts',
  'src/components/Header.tsx',
  'src/components/Language.tsx',
  'src/components/ThemeToggle.tsx',
  'src/components/ThemeScript.tsx',
  'src/components/PwaRegister.tsx',
  'src/components/InstallApp.tsx',
  'src/components/PrivacyCenter.tsx',
  'src/lib/theme.ts',
  'src/components/FaqSearch.tsx',
  'src/lib/v2/ui.ts',
  'public',
  'postcss.config.mjs',
])
  await copy(file);
const transform = async (from, to, fn) =>
  put(to, fn(await readFile(path.join(root, from), 'utf8')));
await put(
  'package.json',
  JSON.stringify({ name: 'taxsolutions-pages', private: true, type: 'module' }),
);
await put(
  'tsconfig.json',
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      lib: ['dom', 'dom.iterable', 'esnext'],
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'react-jsx',
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: [
      'next-env.d.ts',
      'src/**/*.ts',
      'src/**/*.tsx',
      '.next/types/**/*.ts',
    ],
    exclude: ['node_modules'],
  }),
);
await put(
  'next.config.mjs',
  `export default {output:'export',basePath:'/taxsolutions',trailingSlash:true,images:{unoptimized:true},poweredByHeader:false,experimental:{externalDir:true},env:{NEXT_PUBLIC_BASE_PATH:'/taxsolutions'}};\n`,
);
await put(
  'src/lib/content.ts',
  `import {copy,type Locale} from './i18n';import {defaultContacts} from './defaults';export async function content(locale:Locale){return copy[locale]}export async function contacts(){return defaultContacts}\n`,
);
await put(
  'src/lib/demo.ts',
  `export const demo={lv:{title:'Statiskā demonstrācijas versija',text:'Šajā GitHub Pages versijā pieraksts, pieejamības kalendārs, ziņu nosūtīšana un administrēšana nav pieejami. Veidlapu dati netiek vākti vai nosūtīti. Pilnā sistēma ar PostgreSQL un SMTP ir saglabāta projektā un tai nepieciešams atsevišķs serveris.',back:'Atgriezties'},en:{title:'Static demonstration website',text:'Appointment booking, live availability, sending messages and administration are unavailable on GitHub Pages. No form data is collected or sent. The full PostgreSQL and SMTP application remains in the project and requires a separate server.',back:'Go back'},ru:{title:'Статическая демонстрационная версия',text:'На GitHub Pages недоступны бронирование, календарь свободного времени, отправка сообщений и администрирование. Данные форм не собираются и не отправляются. Полная система с PostgreSQL и SMTP сохранена в проекте и требует отдельного сервера.',back:'Вернуться'}};\n`,
);
await put(
  'src/lib/v2/faq.ts',
  `import type {Copy,Locale} from '../i18n';export type FaqItem={id:string;category:string;question:string;answer:string};export async function approvedFaq(locale:Locale,c:Copy):Promise<FaqItem[]>{return c.faq.map(([question,answer],i)=>({id:String(i),category:'general',question,answer}))}`,
);
const notice = `import {demo} from '@/lib/demo';import type {Locale} from '@/lib/i18n';export default function Notice({locale}:{locale:Locale;[key:string]:unknown}){const d=demo[locale];return <aside className="success-box demo-notice"><h3>{d.title}</h3><p>{d.text}</p></aside>}`;
await put('src/components/BookingForm.tsx', notice);
await put('src/components/ContactForm.tsx', notice);
await put(
  'src/components/DemoBanner.tsx',
  `import {demo} from '@/lib/demo';import type {Locale} from '@/lib/i18n';export default function DemoBanner({locale}:{locale:Locale}){const d=demo[locale];return <aside className="demo-banner"><div className="container"><strong>{d.title}</strong><p>{d.text}</p></div></aside>}`,
);
const params = `export const dynamicParams=false;export function generateStaticParams(){return ['lv','en','ru'].map(locale=>({locale}))}`;
await transform(
  'src/app/[locale]/page.tsx',
  'src/app/[locale]/page.tsx',
  (s) => {
    if (
      !s.includes("import { db } from '@/lib/db';") ||
      !s.includes(
        "db.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } })",
      )
    )
      throw Error(
        'Home page data loader changed; update static export adapter.',
      );
    return s
      .replace(
        "import { db } from '@/lib/db';",
        "import {defaultServices} from '@/lib/defaults';\nimport DemoBanner from '@/components/DemoBanner';",
      )
      .replace(
        "export const dynamic = 'force-dynamic';",
        `export const dynamic='force-static';${params}`,
      )
      .replace(
        "db.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } })",
        'Promise.resolve([...defaultServices].sort((a,b)=>a.id.localeCompare(b.id)))',
      )
      .replace(
        '<Header locale={locale} c={c} />',
        '<Header locale={locale} c={c} /><DemoBanner locale={locale}/>',
      )
      .replace(
        'canonical: `/${locale}`',
        'canonical: `/taxsolutions/${locale}/`',
      )
      .replace(
        "languages: { lv: '/lv', en: '/en', ru: '/ru', 'x-default': '/lv' }",
        "languages: { lv: '/taxsolutions/lv/', en: '/taxsolutions/en/', ru: '/taxsolutions/ru/', 'x-default': '/taxsolutions/lv/' }",
      )
      .replace(
        "images: ['/opengraph-image']",
        "images: ['/taxsolutions/social.svg']",
      )
      .replaceAll(
        'href={`/${locale}/privacy`}',
        'href={`/taxsolutions/${locale}/privacy/`}',
      )
      .replaceAll(
        'href={`/${locale}/terms`}',
        'href={`/taxsolutions/${locale}/terms/`}',
      )
      .replaceAll(
        'href={`/${locale}/legal`}',
        'href={`/taxsolutions/${locale}/legal/`}',
      )
      .replaceAll('href={`/${locale}/cookies`}', 'href={`/taxsolutions/${locale}/cookies/`}')
      .replaceAll('href={`/${locale}/privacy#privacy-center`}', 'href={`/taxsolutions/${locale}/privacy/#privacy-center`}');
  },
);
await transform(
  'src/app/[locale]/[document]/page.tsx',
  'src/app/[locale]/[document]/page.tsx',
  (s) =>
    s
      .replace(
        "export const dynamic = 'force-dynamic';",
        `export const dynamic='force-static';export const dynamicParams=false;export function generateStaticParams(){return ['lv','en','ru'].flatMap(locale=>['privacy','terms','legal','cookies'].map(document=>({locale,document})))}`,
      )
      .replace(
        "import Header from '@/components/Header';",
        "import Header from '@/components/Header';\nimport DemoBanner from '@/components/DemoBanner';",
      )
      .replace(
        '<Header locale={locale} c={c} />',
        '<Header locale={locale} c={c} /><DemoBanner locale={locale}/>',
      )
      .replace(
        'canonical: `/${locale}/${document}`',
        'canonical: `/taxsolutions/${locale}/${document}/`',
      )
      .replaceAll('`/lv/${document}`', '`/taxsolutions/lv/${document}/`')
      .replaceAll('`/en/${document}`', '`/taxsolutions/en/${document}/`')
      .replaceAll('`/ru/${document}`', '`/taxsolutions/ru/${document}/`')
      .replace('href={`/${locale}`}', 'href={`/taxsolutions/${locale}/`}'),
);
await transform('src/components/Header.tsx', 'src/components/Header.tsx', (s) =>
  s
    .replaceAll(
      'href={`/${locale}#${a}`}',
      'href={`/taxsolutions/${locale}/#${a}`}',
    )
    .replaceAll(
      'href={`/${locale}#booking`}',
      'href={`/taxsolutions/${locale}/#booking`}',
    ),
);
await transform(
  'src/components/Language.tsx',
  'src/components/Language.tsx',
  (s) =>
    s
      .replace(
        'const path = usePathname();',
        "const raw = usePathname();const path=raw.startsWith('/taxsolutions/')?raw.slice('/taxsolutions'.length):raw;",
      )
      .replace(
        'href={path.replace(/^\\/(lv|en|ru)/, `/${l}`)}',
        'href={`/taxsolutions${path.replace(/^\\/(lv|en|ru)/, `/${l}`)}`}',
      ),
);
await transform(
  'src/components/PrivacyCenter.tsx',
  'src/components/PrivacyCenter.tsx',
  (s) => s
    .replaceAll('href={`/${locale}/privacy`}', 'href={`/taxsolutions/${locale}/privacy/`}')
    .replaceAll('href={`/${locale}/cookies`}', 'href={`/taxsolutions/${locale}/cookies/`}'),
);
// Explicit localized root layouts give every exported HTML file its correct lang.
for (const locale of ['lv', 'en', 'ru']) {
  const group = `src/app/(${locale})/${locale}`;
  await put(
    `${group}/layout.tsx`,
    `import '@/app/globals.css';import ThemeScript from '@/components/ThemeScript';import PwaRegister from '@/components/PwaRegister';export {metadata} from '@/lib/metadata';export default function Layout({children}:{children:React.ReactNode}){return <html lang="${locale}" data-theme="light" suppressHydrationWarning><head><ThemeScript/></head><body>{children}<PwaRegister/></body></html>}`,
  );
  await put(
    `${group}/page.tsx`,
    `import Page,{generateMetadata as metadataForLocale} from '@/app/[locale]/page';export function generateMetadata(){return metadataForLocale({params:Promise.resolve({locale:'${locale}'})})}export default function LocalPage(){return Page({params:Promise.resolve({locale:'${locale}'})})}`,
  );
  for (const document of ['privacy', 'terms', 'legal', 'cookies'])
    await put(
      `${group}/${document}/page.tsx`,
      `import Page,{generateMetadata as metadataForLocale} from '@/app/[locale]/[document]/page';const params=Promise.resolve({locale:'${locale}',document:'${document}'});export function generateMetadata(){return metadataForLocale({params})}export default function LegalPage(){return Page({params})}`,
    );
}
// Move reusable page modules out of route discovery to avoid duplicate routes.
await mkdir(path.join(target, 'src/templates'), { recursive: true });
await cp(
  path.join(target, 'src/app/[locale]/page.tsx'),
  path.join(target, 'src/templates/home.tsx'),
);
await cp(
  path.join(target, 'src/app/[locale]/[document]/page.tsx'),
  path.join(target, 'src/templates/legal.tsx'),
);
await rm(path.join(target, 'src/app/[locale]'), { recursive: true });
for (const locale of ['lv', 'en', 'ru']) {
  const base = `src/app/(${locale})/${locale}`;
  for (const file of [
    'page.tsx',
    'privacy/page.tsx',
    'terms/page.tsx',
    'legal/page.tsx',
    'cookies/page.tsx',
  ]) {
    const p = path.join(target, base, file);
    let s = await readFile(p, 'utf8');
    s = s
      .replace('@/app/[locale]/page', '@/templates/home')
      .replace('@/app/[locale]/[document]/page', '@/templates/legal');
    await writeFile(p, s);
  }
}
await put(
  'src/lib/metadata.ts',
  `import type {Metadata} from 'next';export const metadata:Metadata={metadataBase:new URL('https://a-zcare.github.io'),title:{default:'TaxSolutions',template:'%s | TaxSolutions'},manifest:'/taxsolutions/manifest.webmanifest',icons:{icon:'/taxsolutions/icon.svg',apple:'/taxsolutions/icons/apple-touch-icon.png'},appleWebApp:{capable:true,statusBarStyle:'default',title:'TaxSolutions'},robots:{index:false,follow:true}};`,
);
await put(
  'src/app/(entry)/layout.tsx',
  `import '@/app/globals.css';import ThemeScript from '@/components/ThemeScript';export {metadata} from '@/lib/metadata';export default function Layout({children}:{children:React.ReactNode}){return <html lang="lv" data-theme="light" suppressHydrationWarning><head><ThemeScript/></head><body>{children}</body></html>}`,
);
await put(
  'src/app/(entry)/page.tsx',
  `export default function Page(){return <main className="container legal-page"><meta httpEquiv="refresh" content="0;url=/taxsolutions/lv/"/><h1>TaxSolutions</h1><nav className="hero-actions"><a className="button" href="/taxsolutions/lv/">Latviski</a><a className="button secondary" href="/taxsolutions/en/">English</a><a className="button secondary" href="/taxsolutions/ru/">Русский</a></nav></main>}`,
);
await put(
  'src/app/(entry)/admin/page.tsx',
  `import {demo} from '@/lib/demo';import ThemeToggle from '@/components/ThemeToggle';export default function Page(){return <main className="container legal-page"><div className="admin-toolbar"><h1>TaxSolutions / Admin</h1><ThemeToggle/></div>{(['lv','en','ru'] as const).map(locale=><section key={locale} lang={locale}><h2>{demo[locale].title}</h2><p>{demo[locale].text}</p><a className="text-link" href={\`/taxsolutions/\${locale}/\`}>{demo[locale].back} →</a></section>)}</main>}`,
);
await put(
  'src/app/(entry)/not-found.tsx',
  `export default function Page(){return <main className="container legal-page"><h1>404 · TaxSolutions</h1><p>Lapa nav atrasta · Page not found · Страница не найдена</p><a className="button" href="/taxsolutions/lv/">TaxSolutions →</a></main>}`,
);
const css = await readFile(path.join(target, 'src/app/globals.css'), 'utf8');
await put(
  'src/app/globals.css',
  css +
    `\n.demo-banner{background:var(--pale);border-bottom:1px solid var(--line);padding:18px 0;color:var(--navy)}.demo-banner strong{font-size:13px}.demo-banner p{font-size:12px;margin:6px 0 0;max-width:950px}.demo-notice{box-shadow:none}.demo-notice p{margin-bottom:0}\n`,
);
await put(
  'public/social.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#EFF6FF"/><text x="100" y="280" font-family="Arial" font-size="90" fill="#123B70">TaxSolutions</text><text x="100" y="380" font-family="Arial" font-size="35" fill="#2563EB">Accounting &amp; Tax · LV / EN / RU</text></svg>`,
);
const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/next/dist/bin/next'),
    'build',
    target,
    '--webpack',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await put('out/.nojekyll', '');
await put(
  'out/robots.txt',
  'User-agent: *\nDisallow: /taxsolutions/admin/\nSitemap: https://a-zcare.github.io/taxsolutions/sitemap.xml\n',
);
const urls = ['lv', 'en', 'ru'].flatMap((l) =>
  ['', 'privacy/', 'terms/', 'legal/', 'cookies/'].map(
    (p) => `https://a-zcare.github.io/taxsolutions/${l}/${p}`,
  ),
);
await put(
  'out/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`,
);
console.log(
  'GitHub Pages export ready: .pages-build/out (no database or SMTP required).',
);
