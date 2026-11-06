import type { Locale } from '@/lib/i18n';

const copy = {
  lv: {
    title: 'Privātuma un sīkdatņu iestatījumi',
    lead: 'Šajā vietnē pašlaik netiek izmantota izvēles analītika, reklāma vai trešo pušu izsekošana. Tāpēc nav izvēles sīkdatņu, kurām būtu jālūdz piekrišana.',
    required: 'Nepieciešamā funkcionalitāte',
    requiredText: 'Administratora pieteikšanās sesijas sīkdatne tax-session ir HttpOnly, SameSite=Strict un derīga līdz 8 stundām; HTTPS vidē tā ir Secure. Tā tiek izmantota tikai administratora autentifikācijai. Gaišā/tumšā tēma tiek glabāta pārlūka localStorage kā lietotāja saskarnes izvēle, nevis sīkdatne.',
    optional: 'Izvēles sīkdatnes un analītika',
    optionalText: 'Pašlaik netiek ielādēti analītikas, mārketinga vai izvēles funkcionalitātes skripti. Ja tas mainīsies, iestatījumi un piekrišanas izvēle tiks ieviesti pirms šādu skriptu aktivizēšanas.',
    contact: 'Lai mainītu vai noskaidrotu datu apstrādi, sazinieties ar vietnē norādīto pārzini. Pārziņa dati un faktiskie glabāšanas termiņi jāapstiprina pirms produkcijas palaišanas.',
    policy: 'Privātuma politika', cookies: 'Sīkdatņu politika',
  },
  en: {
    title: 'Privacy and cookie settings',
    lead: 'This site currently uses no optional analytics, advertising, or third-party tracking. There are no optional cookies that require a consent choice.',
    required: 'Strictly necessary functionality',
    requiredText: 'The administrator session cookie tax-session is HttpOnly, SameSite=Strict, expires after 8 hours, and is Secure in HTTPS production. It is used only for administrator authentication. Light/dark theme preference is stored in browser localStorage as an interface preference, not a cookie.',
    optional: 'Optional cookies and analytics',
    optionalText: 'No analytics, marketing, or optional functionality scripts are currently loaded. If this changes, controls and consent choice will be implemented before activating such scripts.',
    contact: 'For questions or requests about data processing, contact the controller listed on the site. Controller details and actual retention periods must be confirmed before production launch.',
    policy: 'Privacy policy', cookies: 'Cookie policy',
  },
  ru: {
    title: 'Настройки конфиденциальности и cookies',
    lead: 'Сейчас сайт не использует необязательную аналитику, рекламу или стороннее отслеживание. Необязательных cookies, для которых требуется согласие, нет.',
    required: 'Строго необходимая функциональность',
    requiredText: 'Cookie сессии администратора tax-session имеет флаги HttpOnly и SameSite=Strict, действует до 8 часов и получает Secure при работе через HTTPS. Она используется только для аутентификации администратора. Выбор светлой/тёмной темы хранится в localStorage браузера как настройка интерфейса, а не cookie.',
    optional: 'Необязательные cookies и аналитика',
    optionalText: 'Сейчас не загружаются скрипты аналитики, маркетинга или необязательных функций. Если это изменится, настройки и выбор согласия будут добавлены до активации таких скриптов.',
    contact: 'По вопросам обработки данных обратитесь к оператору, указанному на сайте. Данные оператора и фактические сроки хранения необходимо подтвердить до запуска production.',
    policy: 'Политика конфиденциальности', cookies: 'Политика cookies',
  },
} satisfies Record<Locale, Record<string, string>>;

export default function PrivacyCenter({ locale }: { locale: Locale }) {
  const text = copy[locale];
  return (
    <section id="privacy-center" className="privacy-center" aria-labelledby="privacy-center-title">
      <h2 id="privacy-center-title">{text.title}</h2>
      <p>{text.lead}</p>
      <div className="privacy-center-grid">
        <article><h3>{text.required}</h3><p>{text.requiredText}</p></article>
        <article><h3>{text.optional}</h3><p>{text.optionalText}</p></article>
      </div>
      <p>{text.contact}</p>
      <nav aria-label={text.title}>
        <a href={`/${locale}/privacy`}>{text.policy}</a>
        <a href={`/${locale}/cookies`}>{text.cookies}</a>
      </nav>
    </section>
  );
}
