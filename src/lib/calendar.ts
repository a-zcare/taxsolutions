import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { Schedule } from './defaults';
export const ZONE = 'Europe/Riga';
export function dateInRiga(d: Date) {
  return formatInTimeZone(d, ZONE, 'yyyy-MM-dd');
}
export function slotsForDay(
  date: string,
  duration: number,
  rules: Schedule,
  busy: { start: Date; end: Date }[],
  now = new Date(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const noon = fromZonedTime(`${date}T12:00:00`, ZONE);
  if (!Number.isFinite(noon.getTime()) || dateInRiga(noon) !== date) return [];
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const days = Math.round(
    (Date.parse(`${date}T12:00:00Z`) -
      Date.parse(`${dateInRiga(now)}T12:00:00Z`)) /
      86400000,
  );
  if (
    days < 0 ||
    days > rules.horizonDays ||
    rules.closedDates.includes(date) ||
    (!rules.weekdays.includes(day) && !rules.openDates.includes(date))
  )
    return [];
  const out: string[] = [];
  for (
    let minute = rules.start * 60;
    minute + duration <= rules.end * 60;
    minute += 30
  ) {
    const local = `${date}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`;
    const start = fromZonedTime(local, ZONE);
    const end = new Date(start.getTime() + duration * 60000);
    if (start.getTime() < now.getTime() + rules.leadHours * 3600000) continue;
    const blockedStart = new Date(
        start.getTime() - (rules.bufferMinutes ?? 0) * 60000,
      ),
      blockedEnd = new Date(end.getTime() + (rules.bufferMinutes ?? 0) * 60000);
    if (
      (rules.breaks ?? []).some(
        (b) =>
          blockedStart < fromZonedTime(`${date}T${b.end}:00`, ZONE) &&
          blockedEnd > fromZonedTime(`${date}T${b.start}:00`, ZONE),
      )
    )
      continue;
    if (busy.some((b) => blockedStart < b.end && blockedEnd > b.start))
      continue;
    out.push(start.toISOString());
  }
  return out;
}
