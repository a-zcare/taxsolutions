import { describe, it, expect } from 'vitest';
import {
  calendarRange,
  moveCalendar,
  rigaInput,
} from '../src/lib/v2/crm-calendar';
describe('CRM Riga calendar', () => {
  it('uses real local midnight, including 23h and 25h DST days', () => {
    const spring = calendarRange('2027-03-28', 'day');
    expect(spring.start.toISOString()).toBe('2027-03-27T22:00:00.000Z');
    expect((spring.end.getTime() - spring.start.getTime()) / 3600000).toBe(23);
    const autumn = calendarRange('2027-10-31', 'day');
    expect((autumn.end.getTime() - autumn.start.getTime()) / 3600000).toBe(25);
  });
  it('starts the week on Monday, with a complete 42-day month across year boundaries', () => {
    expect(calendarRange('2027-01-03', 'week').days).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    const month = calendarRange('2027-01-15', 'month');
    expect(month.days).toHaveLength(42);
    expect(month.days[0]).toBe('2026-12-28');
    expect(month.days.at(-1)).toBe('2027-02-07');
  });
  it('navigates month end without skipping February and rejects non-dates', () => {
    expect(moveCalendar('2027-01-31', 'month', 1)).toBe('2027-02-01');
    expect(moveCalendar('2027-01-01', 'week', -1)).toBe('2026-12-25');
    expect(() => calendarRange('2027-02-30', 'day')).toThrow();
  });
  it('converts local form values and rejects spring-forward nonexistent times', () => {
    expect(rigaInput('2027-01-04T09:30')).toBe('2027-01-04T07:30:00.000Z');
    expect(() => rigaInput('2027-03-28T03:30')).toThrow('INVALID_LOCAL_TIME');
  });
});
