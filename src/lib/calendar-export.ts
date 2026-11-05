export function googleCalendarLink({
  title,
  start,
  end,
}: {
  title: string;
  start: Date;
  end: Date;
}) {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `TaxSolutions — ${title}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    ctz: 'Europe/Riga',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
export function calendarFile({
  id,
  title,
  start,
  end,
}: {
  id: string;
  title: string;
  start: Date;
  end: Date;
}) {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaxSolutions//Consultations//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id}@taxsolutions`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`TaxSolutions — ${title}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
