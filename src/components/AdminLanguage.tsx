'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import ThemeToggle from './ThemeToggle';
const translations: Record<string, Partial<Record<Locale, string>>> = {
  'Buffer minutes': {
    lv: 'Buferis pirms un pēc konsultācijas (minūtes)',
    ru: 'Буфер до и после консультации (минуты)',
  },
  'Daily breaks': { lv: 'Ikdienas pārtraukumi', ru: 'Ежедневные перерывы' },
  'Break start': { lv: 'Pārtraukuma sākums', ru: 'Начало перерыва' },
  'Break end': { lv: 'Pārtraukuma beigas', ru: 'Конец перерыва' },
  'Add break': { lv: 'Pievienot pārtraukumu', ru: 'Добавить перерыв' },
  'Authenticator code': {
    lv: 'Autentifikatora kods',
    ru: 'Код аутентификатора',
  },
  'Existing appointments remain valid. Closed dates take priority.': {
    lv: 'Esošie pieraksti paliek spēkā. Slēgtām dienām ir prioritāte.',
    ru: 'Существующие записи сохраняются. Закрытые даты имеют приоритет.',
  },
  'Opening hour': { lv: 'Darba sākums (stunda)', ru: 'Начало работы (час)' },
  'Closing hour': { lv: 'Darba beigas (stunda)', ru: 'Конец работы (час)' },
  'Advance notice (hours)': {
    lv: 'Minimālais laiks pirms pieraksta (stundas)',
    ru: 'Минимальное время до записи (часы)',
  },
  'Booking horizon (days)': {
    lv: 'Pieraksta periods (dienas)',
    ru: 'Горизонт записи (дни)',
  },
  'Working days': { lv: 'Darba dienas', ru: 'Рабочие дни' },
  'Holidays & vacation': {
    lv: 'Brīvdienas un atvaļinājums',
    ru: 'Праздники и отпуск',
  },
  'Additional working dates': {
    lv: 'Papildu darba dienas',
    ru: 'Дополнительные рабочие дни',
  },
  'Add dates individually, including public holidays each year.': {
    lv: 'Pievienojiet datumus, tostarp svētku dienas katru gadu.',
    ru: 'Добавляйте даты, в том числе праздничные дни на каждый год.',
  },
  Date: { lv: 'Datums', ru: 'Дата' },
  'Add date': { lv: 'Pievienot datumu', ru: 'Добавить дату' },
  Remove: { lv: 'Noņemt', ru: 'Удалить' },
  Phone: { lv: 'Tālrunis', ru: 'Телефон' },
  Address: { lv: 'Adrese', ru: 'Адрес' },
  Company: { lv: 'Uzņēmums', ru: 'Компания' },
  'Registration number': {
    lv: 'Reģistrācijas numurs',
    ru: 'Регистрационный номер',
  },
  'VAT number & status': {
    lv: 'PVN numurs un statuss',
    ru: 'Номер и статус НДС',
  },
  'Use verified company information. Empty fields remain placeholders.': {
    lv: 'Izmantojiet pārbaudītus uzņēmuma datus. Tukšajiem laukiem būs aizvietotājteksts.',
    ru: 'Укажите проверенные данные компании. Пустые поля отображаются как заполнители.',
  },
  'Edit the visible text below. Changes are saved for the selected language.': {
    lv: 'Rediģējiet tekstus zemāk. Izmaiņas tiks saglabātas izvēlētajā valodā.',
    ru: 'Редактируйте тексты ниже. Изменения сохраняются для выбранного языка.',
  },
  Text: { lv: 'Teksts', ru: 'Текст' },
  Question: { lv: 'Jautājums', ru: 'Вопрос' },
  Answer: { lv: 'Atbilde', ru: 'Ответ' },
  All: { lv: 'Visi', ru: 'Все' },
  Administration: { lv: 'Administrēšana', ru: 'Администрирование' },
  'Business overview': { lv: 'Uzņēmuma pārskats', ru: 'Обзор работы' },
  WORKSPACE: { lv: 'DARBA VIETA', ru: 'РАБОЧАЯ ОБЛАСТЬ' },
  'Sign out': { lv: 'Iziet', ru: 'Выйти' },
  'Sign in →': { lv: 'Ieiet →', ru: 'Войти →' },
  'Signing in…': { lv: 'Pieslēdzas…', ru: 'Вход…' },
  Email: { lv: 'E-pasts', ru: 'Email' },
  Password: { lv: 'Parole', ru: 'Пароль' },
  'Authorized personnel only · LV / EN / RU content management': {
    lv: 'Tikai pilnvarotiem lietotājiem · satura pārvaldība LV / EN / RU',
    ru: 'Только для уполномоченных пользователей · управление контентом LV / EN / RU',
  },
  'Too many attempts. Try again in 15 minutes.': {
    lv: 'Pārāk daudz mēģinājumu. Mēģiniet pēc 15 minūtēm.',
    ru: 'Слишком много попыток. Повторите через 15 минут.',
  },
  'Sign-in failed. Check credentials.': {
    lv: 'Neizdevās ieiet. Pārbaudiet piekļuves datus.',
    ru: 'Не удалось войти. Проверьте данные.',
  },
  'Unable to connect.': {
    lv: 'Neizdevās izveidot savienojumu.',
    ru: 'Не удалось подключиться.',
  },
  'Unable to load data. Retry.': {
    lv: 'Neizdevās ielādēt datus. Mēģiniet vēlreiz.',
    ru: 'Не удалось загрузить данные. Повторите попытку.',
  },
  'Saved successfully.': { lv: 'Saglabāts.', ru: 'Сохранено.' },
  'Unable to save. Check input. Cancelled bookings cannot be reopened.': {
    lv: 'Neizdevās saglabāt. Pārbaudiet ievadi. Atceltu pierakstu nevar atjaunot.',
    ru: 'Не удалось сохранить. Проверьте данные. Отменённые записи нельзя восстановить.',
  },
  'upcoming appointments': {
    lv: 'gaidāmās konsultācijas',
    ru: 'предстоящих консультаций',
  },
  'emails waiting for delivery': {
    lv: 'e-pasti gaida nosūtīšanu',
    ru: 'писем в очереди',
  },
  bookings: { lv: 'pieraksti', ru: 'записи' },
  services: { lv: 'pakalpojumi', ru: 'услуги' },
  schedule: { lv: 'darba laiks', ru: 'расписание' },
  contacts: { lv: 'kontakti', ru: 'контакты' },
  content: { lv: 'saturs', ru: 'контент' },
  'Load / retry': {
    lv: 'Ielādēt / mēģināt vēlreiz',
    ru: 'Загрузить / повторить',
  },
  Appointments: { lv: 'Pieraksti', ru: 'Записи' },
  Upcoming: { lv: 'Gaidāmie', ru: 'Предстоящие' },
  'All (latest 500)': { lv: 'Visi (pēdējie 500)', ru: 'Все (последние 500)' },
  Pending: { lv: 'Gaida apstiprinājumu', ru: 'Ожидают подтверждения' },
  Confirmed: { lv: 'Apstiprināti', ru: 'Подтверждены' },
  Cancelled: { lv: 'Atcelti', ru: 'Отменены' },
  'Europe/Riga': { lv: 'Europe/Riga', ru: 'Europe/Riga' },
  Client: { lv: 'Klients', ru: 'Клиент' },
  'Service / notes': {
    lv: 'Pakalpojums / piezīmes',
    ru: 'Услуга / комментарии',
  },
  Status: { lv: 'Statuss', ru: 'Статус' },
  PENDING: { lv: 'Gaida apstiprinājumu', ru: 'Ожидает подтверждения' },
  CONFIRMED: { lv: 'Apstiprināts', ru: 'Подтверждено' },
  CANCELLED: { lv: 'Atcelts', ru: 'Отменено' },
  COMPLETED: { lv: 'Pabeigts', ru: 'Завершено' },
  'Prices in cents (EUR). Durations in 30-minute increments. Existing appointments retain their reserved duration.':
    {
      lv: 'Cenas centos (EUR). Ilgums ar 30 minūšu soli. Esošie pieraksti saglabā sākotnējo ilgumu.',
      ru: 'Цены в евроцентах. Продолжительность кратна 30 минутам. Длительность существующих записей сохраняется.',
    },
  Description: { lv: 'Apraksts', ru: 'Описание' },
  'Price (EUR cents)': { lv: 'Cena (eirocenti)', ru: 'Цена (евроценты)' },
  Type: { lv: 'Veids', ru: 'Тип' },
  'Duration (minutes)': { lv: 'Ilgums (minūtes)', ru: 'Длительность (минуты)' },
  Active: { lv: 'Aktīvs', ru: 'Активна' },
  'Save service': { lv: 'Saglabāt pakalpojumu', ru: 'Сохранить услугу' },
  FIXED: { lv: 'Fiksēta', ru: 'Фиксированная' },
  FROM: { lv: 'No', ru: 'От' },
  HOURLY: { lv: 'Stundā', ru: 'Почасовая' },
  MONTHLY: { lv: 'Mēnesī', ru: 'Ежемесячная' },
  'Availability · Europe/Riga': {
    lv: 'Pieejamība · Europe/Riga',
    ru: 'Доступное время · Europe/Riga',
  },
  'start/end: hours 0–24. weekdays: Sunday=0 … Saturday=6. closedDates: holidays/vacations (YYYY-MM-DD). openDates: exceptional working dates. Closed dates take priority. Existing reservations remain valid when hours change. Configure Latvian holidays explicitly each year.':
    {
      lv: 'start/end: stundas 0–24. weekdays: svētdiena=0 … sestdiena=6. closedDates: brīvdienas/atvaļinājums (GGGG-MM-DD). openDates: papildu darba dienas. Slēgtām dienām ir prioritāte. Esošie pieraksti paliek spēkā. Latvijas svētku dienas jānorāda katru gadu.',
      ru: 'start/end: часы 0–24. weekdays: воскресенье=0 … суббота=6. closedDates: праздники/отпуск (ГГГГ-ММ-ДД). openDates: дополнительные рабочие дни. Закрытые даты имеют приоритет. Существующие записи сохраняются. Праздники Латвии нужно указывать каждый год.',
    },
  'Contact & company details': {
    lv: 'Kontakti un uzņēmuma dati',
    ru: 'Контакты и реквизиты',
  },
  'Replace empty values with verified company details. Email is required to receive contact form messages.':
    {
      lv: 'Aizpildiet tukšos laukus ar pārbaudītiem uzņēmuma datiem. E-pasts nepieciešams kontaktformas ziņu saņemšanai.',
      ru: 'Заполните пустые значения проверенными реквизитами. Для приёма сообщений формы нужен email.',
    },
  Language: { lv: 'Valoda', ru: 'Язык' },
  'Edit every public label, notification, FAQ and legal text. Preserve field names and array lengths. Text is rendered as plain text.':
    {
      lv: 'Rediģējiet publiskos tekstus, paziņojumus, jautājumus un juridiskos tekstus. Saglabājiet lauku nosaukumus un masīvu garumus. Teksts tiek attēlots bez HTML.',
      ru: 'Редактируйте тексты, уведомления, FAQ и юридические страницы. Сохраняйте имена полей и длину массивов. Текст отображается без HTML.',
    },
  'Website copy': { lv: 'Vietnes teksti', ru: 'Тексты сайта' },
  'Settings JSON': { lv: 'Iestatījumi JSON', ru: 'Настройки JSON' },
  'Save changes': { lv: 'Saglabāt izmaiņas', ru: 'Сохранить изменения' },
  'Invalid JSON. Check commas and quotation marks.': {
    lv: 'Nederīgs JSON. Pārbaudiet komatus un pēdiņas.',
    ru: 'Некорректный JSON. Проверьте запятые и кавычки.',
  },
  name: { lv: 'nosaukums', ru: 'название' },
  'Add service': { lv: 'Pievienot pakalpojumu', ru: 'Добавить услугу' },
  'New service': { lv: 'Jauns pakalpojums', ru: 'Новая услуга' },
};
const Context = createContext<{ t: (key: string) => string; locale: Locale }>({
  t: (key) => key,
  locale: 'en',
});
export function useAdminLanguage() {
  return useContext(Context);
}
export default function AdminLanguage({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>('lv');
  useEffect(() => {
    const saved = localStorage.getItem('tax-admin-language');
    if (['lv', 'en', 'ru'].includes(saved ?? '')) setLocale(saved as Locale);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const t = (key: string) => translations[key]?.[locale] ?? key;
  return (
    <Context.Provider value={{ locale, t }}>
      <div className="admin-language">
        <ThemeToggle locale={locale} />
        <label>
          LV / EN / RU
          <select
            aria-label="Language / Valoda / Язык"
            value={locale}
            onChange={(e) => {
              const next = e.target.value as Locale;
              setLocale(next);
              localStorage.setItem('tax-admin-language', next);
            }}
          >
            {['lv', 'en', 'ru'].map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      {children}
    </Context.Provider>
  );
}
