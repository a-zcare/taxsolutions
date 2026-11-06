export const defaultServices = [
  {
    id: 'accounting',
    price: 12000,
    priceType: 'MONTHLY',
    duration: 60,
    translations: {
      lv: {
        name: 'Grāmatvedības apkalpošana',
        description: 'Ikdienas uzskaite, dokumenti un finanšu pārskati.',
      },
      en: {
        name: 'Accounting services',
        description: 'Everyday bookkeeping, documents and financial reports.',
      },
      ru: {
        name: 'Бухгалтерское обслуживание',
        description: 'Ежедневный учёт, документы и финансовые отчёты.',
      },
    },
  },
  {
    id: 'tax',
    price: 6000,
    priceType: 'HOURLY',
    duration: 60,
    translations: {
      lv: {
        name: 'Nodokļu konsultācijas',
        description: 'Atbildes par nodokļiem un to piemērošanu.',
      },
      en: {
        name: 'Tax consultations',
        description: 'Clarity on taxes and how they apply to you.',
      },
      ru: {
        name: 'Налоговые консультации',
        description: 'Разъяснения по налогам и их применению.',
      },
    },
  },
  {
    id: 'payroll',
    price: 1500,
    priceType: 'FROM',
    duration: 30,
    translations: {
      lv: {
        name: 'Darba algu aprēķins',
        description: 'Algu aprēķini un saistītās atskaites.',
      },
      en: {
        name: 'Payroll',
        description: 'Salary calculations and related reporting.',
      },
      ru: {
        name: 'Расчёт заработной платы',
        description: 'Расчёт зарплат и связанная отчётность.',
      },
    },
  },
  {
    id: 'annual',
    price: 15000,
    priceType: 'FROM',
    duration: 60,
    translations: {
      lv: {
        name: 'Gada pārskati',
        description: 'Gada slēgšana un pārskatu sagatavošana.',
      },
      en: {
        name: 'Annual reporting',
        description: 'Year-end closing and report preparation.',
      },
      ru: {
        name: 'Годовая отчётность',
        description: 'Закрытие года и подготовка отчётов.',
      },
    },
  },
  {
    id: 'registration',
    price: 20000,
    priceType: 'FIXED',
    duration: 60,
    translations: {
      lv: {
        name: 'Uzņēmuma reģistrācija',
        description: 'Atbalsts dokumentu sagatavošanā uzņēmuma dibināšanai.',
      },
      en: {
        name: 'Company registration',
        description: 'Support preparing documents to start your company.',
      },
      ru: {
        name: 'Регистрация компаний',
        description: 'Помощь в подготовке документов для открытия компании.',
      },
    },
  },
  {
    id: 'oneoff',
    price: 4000,
    priceType: 'HOURLY',
    duration: 60,
    translations: {
      lv: {
        name: 'Vienreizēji pakalpojumi',
        description: 'Konkrēts risinājums atsevišķam grāmatvedības uzdevumam.',
      },
      en: {
        name: 'One-off accounting',
        description: 'Focused help for an individual accounting task.',
      },
      ru: {
        name: 'Разовые бухгалтерские услуги',
        description: 'Решение отдельной бухгалтерской задачи.',
      },
    },
  },
];
export const defaultSchedule = {
  bufferMinutes: 0,
  breaks: [] as { start: string; end: string }[],
  start: 9,
  end: 17,
  weekdays: [1, 2, 3, 4, 5],
  closedDates: [] as string[],
  openDates: [] as string[],
  leadHours: 2,
  horizonDays: 90,
};
export const defaultContacts = {
  phone: '',
  email: '',
  address: '',
  company: '',
  registration: '',
  vat: '',
};
export type Schedule = typeof defaultSchedule;
export type Translations = Record<
  string,
  { name: string; description: string }
>;
