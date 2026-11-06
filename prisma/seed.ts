import { db } from '../src/lib/db';
import { copy, locales } from '../src/lib/i18n';
import {
  defaultServices,
  defaultSchedule,
  defaultContacts,
} from '../src/lib/defaults';
for (const s of defaultServices)
  await db.service.upsert({ where: { id: s.id }, create: s, update: {} });
for (const [key, value] of Object.entries({
  schedule: defaultSchedule,
  contacts: defaultContacts,
}))
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: {},
  });
// Stable IDs preserve operator edits and approval decisions on repeated deployments.
for (let i = 0; i < copy.lv.faq.length; i++) {
  const translations = Object.fromEntries(
    locales.map((locale) => [
      locale,
      {
        question: copy[locale].faq[i][0],
        answer: copy[locale].faq[i][1],
      },
    ]),
  );
  await db.faqEntry.upsert({
    where: { id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` },
    create: {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      category: 'general',
      translations,
      approved: true,
    },
    update: {},
  });
}
await db.$disconnect();
console.log('Seed complete. Existing content preserved.');
