import type { Locale } from './i18n';
import type { DocumentPage } from './document-ai-options';

export const documentTypes = {
  invoice: { lv: 'Rēķins', en: 'Invoice', ru: 'Счёт' },
  receipt: { lv: 'Čeks', en: 'Receipt', ru: 'Чек' },
  contract: { lv: 'Līgums', en: 'Contract', ru: 'Договор' },
  act: { lv: 'Akts', en: 'Acceptance certificate', ru: 'Акт' },
  statement: {
    lv: 'Konta izraksts',
    en: 'Bank statement',
    ru: 'Банковская выписка',
  },
  other: { lv: 'Cits dokuments', en: 'Other document', ru: 'Другой документ' },
};
export type DocumentType = keyof typeof documentTypes;

type Definition = { label: Record<Locale, string>; aliases: string[] };
const builtIn: Record<string, Definition> = {
  number: {
    label: {
      lv: 'Dokumenta numurs',
      en: 'Document number',
      ru: 'Номер документа',
    },
    aliases: [
      'Rēķins Nr.',
      'Rēķins',
      'Čeka Nr.',
      'Līguma Nr.',
      'Akta Nr.',
      'Invoice number',
      'Invoice no.',
      'Invoice #',
      'Receipt no.',
      'Contract no.',
      'Document number',
      'Счёт №',
      'Счет №',
      'Чек №',
      'Акт №',
      'Договор №',
      'Номер документа',
    ],
  },
  date: {
    label: {
      lv: 'Dokumenta datums',
      en: 'Document date',
      ru: 'Дата документа',
    },
    aliases: [
      'Izrakstīšanas datums',
      'Datums',
      'Invoice date',
      'Issue date',
      'Document date',
      'Date',
      'Дата документа',
      'Дата выставления',
      'Дата',
    ],
  },
  dueDate: {
    label: { lv: 'Apmaksas termiņš', en: 'Due date', ru: 'Срок оплаты' },
    aliases: [
      'Apmaksas termiņš',
      'Apmaksāt līdz',
      'Due date',
      'Payment due',
      'Оплатить до',
      'Срок оплаты',
    ],
  },
  supplier: {
    label: { lv: 'Piegādātājs', en: 'Supplier', ru: 'Поставщик' },
    aliases: [
      'Piegādātājs',
      'Pārdevējs',
      'Izrakstītājs',
      'Supplier',
      'Seller',
      'Поставщик',
      'Продавец',
    ],
  },
  customer: {
    label: { lv: 'Klients', en: 'Customer', ru: 'Клиент' },
    aliases: [
      'Pircējs',
      'Klients',
      'Saņēmējs',
      'Customer',
      'Bill to',
      'Покупатель',
      'Клиент',
      'Получатель',
    ],
  },
  registration: {
    label: {
      lv: 'Reģistrācijas numurs',
      en: 'Registration number',
      ru: 'Регистрационный номер',
    },
    aliases: [
      'Reģ. Nr.',
      'Reģistrācijas numurs',
      'Registration number',
      'Регистрационный номер',
      'Рег. номер',
    ],
  },
  iban: {
    label: { lv: 'IBAN', en: 'IBAN', ru: 'IBAN' },
    aliases: ['IBAN', 'Bankas konts', 'Bank account', 'Банковский счёт'],
  },
  net: {
    label: { lv: 'Summa bez PVN', en: 'Subtotal', ru: 'Сумма без НДС' },
    aliases: [
      'Summa bez PVN',
      'Kopā bez PVN',
      'Subtotal',
      'Total excluding VAT',
      'Сумма без НДС',
      'Итого без НДС',
    ],
  },
  vat: {
    label: { lv: 'PVN summa', en: 'VAT amount', ru: 'Сумма НДС' },
    aliases: ['PVN summa', 'PVN', 'VAT amount', 'VAT', 'Сумма НДС', 'НДС'],
  },
  total: {
    label: { lv: 'Kopā apmaksai', en: 'Total amount', ru: 'Итого к оплате' },
    aliases: [
      'Kopā apmaksai',
      'Apmaksai',
      'Kopsumma',
      'Kopā',
      'Invoice total',
      'Amount due',
      'Grand total',
      'Total amount',
      'Total',
      'Итого к оплате',
      'Сумма к оплате',
      'Итого',
      'Всего',
    ],
  },
};

export const maxDocumentFields = 24;
export type FieldSettings = {
  common: string[];
  overrides: Partial<Record<DocumentType, string[]>>;
  custom: Record<string, string>;
};
export const defaultFieldSettings: FieldSettings = {
  common: ['number', 'date', 'supplier', 'total'],
  overrides: {},
  custom: {},
};

export type FieldCandidate = {
  value: string;
  page: number;
  uncertain: boolean;
};

export function detectDocumentType(pages: DocumentPage[]): DocumentType {
  const start = pages[0]?.text.split(/\r?\n/).slice(0, 16).join('\n') ?? '';
  const examples: [DocumentType, RegExp][] = [
    ['statement', /bank statement|konta izraksts|банковская выписка/iu],
    ['invoice', /(?:^|[^\p{L}])(?:invoice|rēķins|сч[её]т)(?:$|[^\p{L}])/iu],
    ['receipt', /(?:^|[^\p{L}])(?:receipt|čeks|кассовый чек)(?:$|[^\p{L}])/iu],
    ['contract', /(?:^|[^\p{L}])(?:contract|līgums|договор)(?:$|[^\p{L}])/iu],
    ['act', /acceptance certificate|pieņemšanas.{0,20}akts|акт при[её]мки/iu],
  ];
  return examples.find(([, re]) => re.test(start))?.[0] ?? 'other';
}

export function fieldLabel(
  key: string,
  settings: FieldSettings,
  locale: Locale,
) {
  return builtIn[key]?.label[locale] ?? settings.custom[key] ?? key;
}

export function availableFields(settings: FieldSettings) {
  return [...Object.keys(builtIn), ...Object.keys(settings.custom)];
}

export function visibleFields(settings: FieldSettings, type: DocumentType) {
  return settings.overrides[type] ?? settings.common;
}

export function readFieldSettings(value: string | null): FieldSettings {
  try {
    if (!value) return defaultFieldSettings;
    const data = JSON.parse(value);
    const custom = Object.fromEntries(
      Object.entries(data.custom ?? {})
        .filter(
          ([key, label]) =>
            /^custom-[a-f0-9-]+$/i.test(key) &&
            typeof label === 'string' &&
            label.trim() &&
            label.length <= 80,
        )
        .slice(0, maxDocumentFields),
    ) as Record<string, string>;
    const valid = new Set([...Object.keys(builtIn), ...Object.keys(custom)]);
    const list = (keys: unknown) =>
      Array.isArray(keys)
        ? [
            ...new Set(
              keys.filter(
                (key): key is string =>
                  typeof key === 'string' && valid.has(key),
              ),
            ),
          ].slice(0, maxDocumentFields)
        : [];
    const overrides = Object.fromEntries(
      Object.keys(documentTypes)
        .filter((type) => Array.isArray(data.overrides?.[type]))
        .map((type) => [type, list(data.overrides[type])]),
    );
    return {
      common: Array.isArray(data.common)
        ? list(data.common)
        : defaultFieldSettings.common,
      overrides,
      custom,
    };
  } catch {
    return defaultFieldSettings;
  }
}

const normalize = (word: string) =>
  word.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const amountFields = ['total', 'net', 'vat'];
const amounts = new Set(amountFields);
function readCents(value: string) {
  const numeric = value.replace(/[^0-9.,]/g, '');
  const decimal = /[.,](\d{1,2})$/.exec(numeric);
  const whole = (decimal ? numeric.slice(0, decimal.index) : numeric).replace(
    /[.,]/g,
    '',
  );
  if (!whole) return NaN;
  const cents = Number(whole) * 100 + Number(decimal?.[1].padEnd(2, '0') ?? 0);
  return Number.isSafeInteger(cents) ? cents : NaN;
}

export function captureFields(
  pages: DocumentPage[],
  keys: string[],
  settings: FieldSettings,
) {
  const result: Record<string, FieldCandidate> = {};
  const inspected = keys.some((key) => amounts.has(key))
    ? new Set([...keys, ...amountFields])
    : keys;
  for (const key of inspected) {
    const names = builtIn[key]?.aliases ?? [settings.custom[key] ?? ''];
    const pattern = new RegExp(
      `^\\s*(?:${names
        .filter(Boolean)
        .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})(?=$|[\\s:#№])\\s*[:#№]?\\s*(.+)$`,
      'iu',
    );
    const found: FieldCandidate[] = [];
    for (const page of pages) {
      const weak = new Set(page.lowConfidenceWords?.map(normalize));
      for (const line of page.text.split(/\r?\n/)) {
        const raw = pattern.exec(line)?.[1].trim();
        if (!raw) continue;
        const value = amounts.has(key)
          ? /^(?:[A-Z]{3}\s*|€\s*)?\d[\d .,'\u00a0]*(?:\s*(?:[A-Z]{3}|€))?/u
              .exec(raw)?.[0]
              .trim()
          : raw.length <= 180
            ? raw
            : undefined;
        if (!value || (key === 'number' && !/\d/.test(value))) continue;
        const uncertain = value
          .split(/\s+/)
          .map(normalize)
          .some((word) => Boolean(word) && weak.has(word));
        found.push({ value, page: page.number, uncertain });
      }
    }
    if (found.length) {
      result[key] = {
        ...found[0],
        uncertain:
          found[0].uncertain ||
          found.some((item) => item.value !== found[0].value),
      };
    } else {
      result[key] = { value: '', page: pages[0]?.number ?? 1, uncertain: true };
    }
  }
  const [total, net, vat] = amountFields.map((key) =>
    readCents(result[key]?.value ?? ''),
  );
  const currencies = new Set(
    amountFields.flatMap((key) => {
      const currency = result[key]?.value.match(/[A-Z]{3}|€/u)?.[0];
      return currency ? [currency === '€' ? 'EUR' : currency] : [];
    }),
  );
  if (
    [total, net, vat].every(Number.isFinite) &&
    currencies.size <= 1 &&
    Math.abs(total - net - vat) > 1
  )
    for (const key of amountFields) result[key].uncertain = true;
  return Object.fromEntries(keys.map((key) => [key, result[key]]));
}
