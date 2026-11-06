import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { content, contacts } from '@/lib/content';
import Header from '@/components/Header';
import PrivacyCenter from '@/components/PrivacyCenter';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; document: string }>;
}) {
  const { locale, document } = await params;
  if (!isLocale(locale) || !['privacy', 'terms', 'legal', 'cookies'].includes(document))
    return {};
  const c = await content(locale);
  return {
    title: document === 'cookies' ? 'Cookies' : c[document as 'privacy' | 'terms' | 'legal'],
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
  if (!isLocale(locale) || !['privacy', 'terms', 'legal', 'cookies'].includes(document))
    notFound();
  const c = await content(locale);
  const contact = await contacts();
  const title = document === 'cookies' ? ({ lv: 'Sīkdatņu politika', en: 'Cookie policy', ru: 'Политика cookies' } as const)[locale] : c[document as 'privacy' | 'terms' | 'legal'];
  const text = document === 'cookies' ? ({
    lv: 'Vietne izmanto tikai administratora autentifikācijai nepieciešamo tax-session sīkdatni. Tā ir HttpOnly, SameSite=Strict, derīga līdz 8 stundām un HTTPS vidē Secure. Analītikas, reklāmas un izvēles trešo pušu sīkdatnes pašlaik netiek izmantotas. Pārziņa identitāte, apstrādātāji un faktiskais glabāšanas grafiks jāapstiprina pirms produkcijas palaišanas.',
    en: 'The site uses only the tax-session cookie required for administrator authentication. It is HttpOnly, SameSite=Strict, expires after 8 hours, and is Secure over HTTPS. Analytics, advertising, and optional third-party cookies are not currently used. The controller identity, processors, and actual retention schedule must be confirmed before production launch.',
    ru: 'Сайт использует только cookie tax-session, необходимую для аутентификации администратора. Она имеет флаги HttpOnly и SameSite=Strict, действует до 8 часов и получает Secure при работе через HTTPS. Аналитические, рекламные и необязательные сторонние cookies сейчас не используются. Оператора, обработчиков и фактический срок хранения необходимо подтвердить до запуска production.',
  } as const)[locale] : c[(document + 'Text') as 'privacyText' | 'termsText' | 'legalText'];
  return (
    <>
      <Header locale={locale} c={c} />
      <main className="container legal-page">
        <p className="section-label">TaxSolutions</p>
        <h1>{title}</h1>
        <p>{text}</p>
        {document === 'privacy' && <PrivacyCenter locale={locale} />}
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
