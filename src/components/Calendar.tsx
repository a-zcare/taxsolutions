'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import type { Locale, Copy } from '@/lib/i18n';
export default function Calendar({
  value,
  onChange,
  serviceId,
  staffId,
  locale,
  c,
  version,
}: {
  value: string;
  onChange: (date: string) => void;
  serviceId: string;
  staffId?: string;
  locale: Locale;
  c: Copy;
  version: number;
}) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Riga',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [month, setMonth] = useState(today.slice(0, 7)),
    [available, setAvailable] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const [lastMonth] = useState(() =>
    new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 7),
  );
  const resetUnavailable = useEffectEvent((available: string[]) => {
    if (!available.includes(value)) onChange('');
  });
  useEffect(() => {
    setLoading(true);
    setError(false);
    setAvailable([]);
    const controller = new AbortController();
    fetch(
      `/api/calendar?month=${month}&serviceId=${serviceId}${staffId ? `&staffId=${staffId}` : ''}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        setAvailable(d.available);
        resetUnavailable(d.available);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, serviceId, staffId, version]);
  const first = new Date(`${month}-01T12:00:00Z`);
  const length = new Date(
    first.getUTCFullYear(),
    first.getUTCMonth() + 1,
    0,
  ).getDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const format = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2026, 0, 5 + i))),
  );
  function move(delta: number) {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
    onChange('');
  }
  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          type="button"
          disabled={month <= today.slice(0, 7)}
          aria-label={
            locale === 'lv'
              ? 'Iepriekšējais mēnesis'
              : locale === 'ru'
                ? 'Предыдущий месяц'
                : 'Previous month'
          }
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <strong aria-live="polite">{format.format(first)}</strong>
        <button
          type="button"
          disabled={month >= lastMonth}
          aria-label={
            locale === 'lv'
              ? 'Nākamais mēnesis'
              : locale === 'ru'
                ? 'Следующий месяц'
                : 'Next month'
          }
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {weekdays.map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`space${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          return (
            <button
              key={date}
              type="button"
              disabled={loading || !available.includes(date)}
              aria-label={date}
              aria-pressed={date === value}
              className={date === value ? 'selected' : ''}
              onClick={() => onChange(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {loading && <p role="status">{c.loading}</p>}
      {error && (
        <p role="alert" className="error">
          {c.error}
        </p>
      )}
    </div>
  );
}
