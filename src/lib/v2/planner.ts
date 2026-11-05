import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
export type Candidate = {
  id: string;
  capacityMinutes: number;
  specializations: string[];
  loadMinutes: number;
};
export function chooseAssignee(
  candidates: Candidate[],
  category: string,
  minutes: number,
) {
  return (
    candidates
      .filter(
        (s) =>
          s.specializations.includes(category) &&
          s.loadMinutes + minutes <= s.capacityMinutes,
      )
      .sort(
        (a, b) =>
          a.loadMinutes / a.capacityMinutes -
            b.loadMinutes / b.capacityMinutes || a.id.localeCompare(b.id),
      )[0]?.id ?? null
  );
}
export function nextDeadline(date: Date, recurrence: string) {
  const wall = formatInTimeZone(date, 'Europe/Riga', "yyyy-MM-dd'T'HH:mm:ss");
  const d = new Date(wall + 'Z');
  if (recurrence === 'DAILY') d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === 'WEEKLY') d.setUTCDate(d.getUTCDate() + 7);
  else if (recurrence === 'MONTHLY') {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else throw Error('INVALID');
  return fromZonedTime(d.toISOString().slice(0, 19), 'Europe/Riga');
}
