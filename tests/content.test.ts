import { describe, it, expect } from 'vitest';
import { copy, locales } from '../src/lib/i18n';
import { defaultServices } from '../src/lib/defaults';
import { calendarFile, googleCalendarLink } from '../src/lib/calendar-export';
describe('Content and calendar exports', () => {
  it('provides every content key and service translation in three languages', () => {
    for (const locale of locales) {
      expect(Object.keys(copy[locale]).sort()).toEqual(
        Object.keys(copy.en).sort(),
      );
      for (const service of defaultServices) {
        expect(service.translations[locale].name.length).toBeGreaterThan(2);
        expect(service.translations[locale].description.length).toBeGreaterThan(
          5,
        );
      }
    }
  });
  it('exports UTC events with escaped user-visible text', () => {
    const event = {
      id: 'test',
      title: 'Tax; VAT, annual\nReport',
      start: new Date('2026-06-01T06:00Z'),
      end: new Date('2026-06-01T07:00Z'),
    };
    const ics = calendarFile(event);
    expect(ics).toContain('DTSTART:20260601T060000Z');
    expect(ics).toContain('Tax\\; VAT\\, annual\\nReport');
    const url = new URL(googleCalendarLink(event));
    expect(url.searchParams.get('ctz')).toBe('Europe/Riga');
    expect(url.searchParams.get('dates')).toBe(
      '20260601T060000Z/20260601T070000Z',
    );
  });
});
