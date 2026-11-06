import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export const CRM_TIMEZONE = 'Europe/Riga';
export type CalendarMode = 'day' | 'week' | 'month';
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function calendarRange(anchor: string, mode: CalendarMode) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    new Date(`${anchor}T12:00Z`).toISOString().slice(0, 10) !== anchor
  )
    throw Error('INVALID');
  let first = mode === 'month' ? `${anchor.slice(0, 7)}-01` : anchor;
  if (mode !== 'day')
    first = shiftDate(
      first,
      -(new Date(`${first}T12:00Z`).getUTCDay() + 6) % 7,
    );
  const days = Array.from(
    { length: mode === 'month' ? 42 : mode === 'week' ? 7 : 1 },
    (_, i) => shiftDate(first, i),
  );
  const endDate = shiftDate(days.at(-1)!, 1);
  return {
    days,
    start: fromZonedTime(`${first}T00:00:00`, CRM_TIMEZONE),
    end: fromZonedTime(`${endDate}T00:00:00`, CRM_TIMEZONE),
  };
}
export function moveCalendar(
  anchor: string,
  mode: CalendarMode,
  direction: number,
) {
  if (mode !== 'month')
    return shiftDate(anchor, direction * (mode === 'week' ? 7 : 1));
  const d = new Date(`${anchor.slice(0, 7)}-01T12:00Z`);
  d.setUTCMonth(d.getUTCMonth() + direction);
  return d.toISOString().slice(0, 10);
}
export function rigaInput(value: string) {
  const instant = fromZonedTime(value, CRM_TIMEZONE);
  if (
    !Number.isFinite(instant.getTime()) ||
    formatInTimeZone(instant, CRM_TIMEZONE, "yyyy-MM-dd'T'HH:mm") !== value
  )
    throw Error('INVALID_LOCAL_TIME');
  return instant.toISOString();
}
