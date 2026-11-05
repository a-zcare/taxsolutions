import { db } from './db';
import { copy, type Locale, type Copy } from './i18n';
import { defaultContacts, defaultSchedule, type Schedule } from './defaults';
export async function content(locale: Locale): Promise<Copy> {
  const row = await db.setting.findUnique({
    where: { key: `content.${locale}` },
  });
  return { ...copy[locale], ...((row?.value as object) ?? {}) } as Copy;
}
export async function schedule(): Promise<Schedule> {
  const row = await db.setting.findUnique({ where: { key: 'schedule' } });
  return { ...defaultSchedule, ...((row?.value as object) ?? {}) };
}
export async function contacts() {
  const row = await db.setting.findUnique({ where: { key: 'contacts' } });
  return { ...defaultContacts, ...((row?.value as object) ?? {}) };
}
