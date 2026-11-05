export const dynamic = 'force-dynamic';
import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? 'http://localhost:3000';
  return ['', '/privacy', '/terms', '/legal'].flatMap((path) =>
    ['lv', 'en', 'ru'].map((locale) => ({
      url: `${base}/${locale}${path}`,
      alternates: {
        languages: Object.fromEntries(
          ['lv', 'en', 'ru'].map((l) => [l, `${base}/${l}${path}`]),
        ),
      },
    })),
  );
}
