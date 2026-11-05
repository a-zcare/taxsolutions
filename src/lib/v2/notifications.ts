import type { Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import type { Locale } from '../i18n';
const texts = {
  lv: {
    requested: 'Pieraksta pieprasījums saņemts',
    confirmed: 'Pieraksts apstiprināts',
    cancelled: 'Pieraksts atcelts',
    rescheduled: 'Pieraksta laiks mainīts',
    reminder: 'Atgādinājums par konsultāciju',
    task: 'Piešķirts uzdevums',
    overdue: 'Uzdevuma termiņš ir pagājis',
    video: 'Videokonsultācijas saite',
    manage: 'Pārvaldīt pierakstu',
  },
  en: {
    requested: 'Appointment request received',
    confirmed: 'Appointment confirmed',
    cancelled: 'Appointment cancelled',
    rescheduled: 'Appointment rescheduled',
    reminder: 'Consultation reminder',
    task: 'Task assigned',
    overdue: 'Task overdue',
    video: 'Video consultation link',
    manage: 'Manage appointment',
  },
  ru: {
    requested: 'Запрос консультации получен',
    confirmed: 'Запись подтверждена',
    cancelled: 'Запись отменена',
    rescheduled: 'Время консультации изменено',
    reminder: 'Напоминание о консультации',
    task: 'Назначена задача',
    overdue: 'Задача просрочена',
    video: 'Ссылка на видеоконсультацию',
    manage: 'Управление записью',
  },
};
export async function notify(
  tx: Prisma.TransactionClient,
  input: {
    to: string;
    locale: string;
    kind: keyof typeof texts.en;
    id: string;
    dedup: string;
    start?: Date;
    link?: string;
  },
) {
  const c = texts[input.locale as Locale] ?? texts.lv;
  const text = [
    'TaxSolutions',
    c[input.kind],
    input.start
      ? `${formatInTimeZone(input.start, 'Europe/Riga', 'dd.MM.yyyy HH:mm')} (Europe/Riga)`
      : '',
    `ID: ${input.id}`,
    input.link ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  await tx.outbox.upsert({
    where: { dedupKey: input.dedup },
    update: {},
    create: {
      to: input.to,
      subject: `TaxSolutions — ${c[input.kind]}`,
      text,
      dedupKey: input.dedup,
    },
  });
}
