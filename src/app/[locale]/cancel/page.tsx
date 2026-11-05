import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { content } from '@/lib/content';
import Cancel from '@/components/Cancel';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  if (!isLocale(locale) || !token || !/^[a-f0-9]{64}$/.test(token)) notFound();
  const c = await content(locale);
  return (
    <main className="container legal-page">
      <h1>{c.cancel}</h1>
      <Cancel token={token} c={c} locale={locale}/>
      <a href={`/${locale}`}>{c.back}</a>
    </main>
  );
}
