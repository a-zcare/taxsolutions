import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { content, contacts } from '@/lib/content';
import Header from '@/components/Header';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; document: string }>;
}) {
  const { locale, document } = await params;
  if (!isLocale(locale) || !['privacy', 'terms', 'legal'].includes(document))
    return {};
  const c = await content(locale);
  return {
    title: c[document as 'privacy' | 'terms' | 'legal'],
    alternates: {
      canonical: `/${locale}/${document}`,
      languages: {
        lv: `/lv/${document}`,
        en: `/en/${document}`,
        ru: `/ru/${document}`,
      },
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; document: string }>;
}) {
  const { locale, document } = await params;
  if (!isLocale(locale) || !['privacy', 'terms', 'legal'].includes(document))
    notFound();
  const c = await content(locale);
  const contact = await contacts();
  const title = c[document as 'privacy' | 'terms' | 'legal'];
  const text =
    c[(document + 'Text') as 'privacyText' | 'termsText' | 'legalText'];
  return (
    <>
      <Header locale={locale} c={c} />
      <main className="container legal-page">
        <p className="section-label">TaxSolutions</p>
        <h1>{title}</h1>
        <p>{text}</p>
        {contact.company && (
          <address>
            {contact.company}
            <br />
            {contact.registration}
            <br />
            {contact.vat}
            <br />
            {contact.address}
            <br />
            {contact.email}
          </address>
        )}
        <a href={`/${locale}`} className="button secondary">
          ← {c.back}
        </a>
      </main>
    </>
  );
}
