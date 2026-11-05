import { describe, it, expect } from 'vitest';
import { slotsForDay, dateInRiga } from '../src/lib/calendar';
import { defaultSchedule } from '../src/lib/defaults';
import { bookingInput, scheduleInput } from '../src/lib/validation';
const now = new Date('2026-01-01T00:00:00Z');
describe('Riga appointment calendar', () => {
  it('uses UTC+2 in winter and UTC+3 in summer', () => {
    expect(slotsForDay('2026-01-05', 60, defaultSchedule, [], now)[0]).toBe(
      '2026-01-05T07:00:00.000Z',
    );
    expect(slotsForDay('2026-03-30', 60, defaultSchedule, [], now)[0]).toBe(
      '2026-03-30T06:00:00.000Z',
    );
  });
  it('handles autumn daylight saving transition', () => {
    const rules = { ...defaultSchedule, horizonDays: 365 };
    expect(slotsForDay('2026-10-23', 60, rules, [], now)[0]).toBe(
      '2026-10-23T06:00:00.000Z',
    );
    expect(slotsForDay('2026-10-26', 60, rules, [], now)[0]).toBe(
      '2026-10-26T07:00:00.000Z',
    );
  });
  it('blocks weekends, holidays, past dates, invalid dates and horizon overflow', () => {
    for (const d of [
      '2026-01-03',
      '2025-12-31',
      '2026-02-30',
      'garbage',
      '2027-01-05',
    ])
      expect(slotsForDay(d, 60, defaultSchedule, [], now)).toEqual([]);
    expect(
      slotsForDay(
        '2026-01-05',
        60,
        { ...defaultSchedule, closedDates: ['2026-01-05'] },
        [],
        now,
      ),
    ).toEqual([]);
  });
  it('allows explicit working weekends and prioritizes closures', () => {
    const rules = { ...defaultSchedule, openDates: ['2026-01-03'] };
    expect(
      slotsForDay('2026-01-03', 60, rules, [], now).length,
    ).toBeGreaterThan(0);
    expect(
      slotsForDay(
        '2026-01-03',
        60,
        { ...rules, closedDates: ['2026-01-03'] },
        [],
        now,
      ),
    ).toEqual([]);
  });
  it('prevents overlaps across different service durations but permits adjacent slots', () => {
    const slots = slotsForDay(
      '2026-01-05',
      60,
      defaultSchedule,
      [
        {
          start: new Date('2026-01-05T08:00Z'),
          end: new Date('2026-01-05T09:00Z'),
        },
      ],
      now,
    );
    expect(slots).toContain('2026-01-05T07:00:00.000Z');
    expect(slots).not.toContain('2026-01-05T07:30:00.000Z');
    expect(slots).not.toContain('2026-01-05T08:30:00.000Z');
    expect(slots).toContain('2026-01-05T09:00:00.000Z');
  });
  it('respects lead time and fits full appointments before closing', () => {
    const slots = slotsForDay(
      '2026-01-05',
      60,
      defaultSchedule,
      [],
      new Date('2026-01-05T07:00Z'),
    );
    expect(slots[0]).toBe('2026-01-05T09:00:00.000Z');
    expect(slots.at(-1)).toBe('2026-01-05T14:00:00.000Z');
  });
  it('calculates local date near midnight', () =>
    expect(dateInRiga(new Date('2026-06-01T22:00Z'))).toBe('2026-06-02'));
  it('rejects missing consent, spam, unsafe inputs and invalid hours', () => {
    expect(bookingInput.safeParse({}).success).toBe(false);
    expect(
      scheduleInput.safeParse({ ...defaultSchedule, start: 17, end: 9 })
        .success,
    ).toBe(false);
  });
});
