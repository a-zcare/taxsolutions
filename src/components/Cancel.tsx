'use client';
import { useEffect, useState } from 'react';
import type { Copy, Locale } from '@/lib/i18n';
import Calendar from './Calendar';
import { workspaceLabel } from '@/lib/v2/ui';
export default function Cancel({
  token,
  c,
  locale,
}: {
  token: string;
  c: Copy;
  locale: Locale;
}) {
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [booking, setBooking] = useState<{
      serviceId: string;
      staffId?: string;
      status: string;
      start: string;
    } | null>(null),
    [date, setDate] = useState(''),
    [slots, setSlots] = useState<string[]>([]),
    [start, setStart] = useState(''),
    [version, setVersion] = useState(0);
  const t = (key: string) => workspaceLabel(key, locale);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bookings/manage?token=${token}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setBooking)
      .catch(() => {});
    return () => controller.abort();
  }, [token, version]);
  useEffect(() => {
    setSlots([]);
    setStart('');
    if (!booking || !date) return;
    const controller = new AbortController();
    fetch(
      `/api/availability?date=${date}&serviceId=${booking.serviceId}${booking.staffId ? `&staffId=${booking.staffId}` : ''}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d) => setSlots(d.slots))
      .catch(() => {});
    return () => controller.abort();
  }, [date, booking]);
  async function mutate(path: string, data: object) {
    setPending(true);
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw Error();
      setMessage(path.endsWith('cancel') ? c.cancelled : t('Saved'));
      setVersion((v) => v + 1);
    } catch {
      setMessage(c.error);
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      {booking && (
        <p>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Europe/Riga',
          }).format(new Date(booking.start))}{' '}
          · {t(booking.status)}
        </p>
      )}
      {booking && ['PENDING', 'CONFIRMED'].includes(booking.status) && (
        <>
          <button
            className="button"
            disabled={pending}
            onClick={() => void mutate('/api/bookings/cancel', { token })}
          >
            {pending ? c.loading : c.cancel}
          </button>
          <details className="admin-card manage-reschedule">
            <summary>{t('Reschedule')}</summary>
            <Calendar
              value={date}
              onChange={setDate}
              serviceId={booking.serviceId}
              staffId={booking.staffId ?? undefined}
              locale={locale}
              c={c}
              version={version}
            />
            <div className="time-slots">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  aria-pressed={start === s}
                  className={start === s ? 'selected' : ''}
                  onClick={() => setStart(s)}
                >
                  {new Intl.DateTimeFormat(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Riga',
                  }).format(new Date(s))}
                </button>
              ))}
            </div>
            <button
              className="button"
              disabled={!start || pending}
              onClick={() =>
                void mutate('/api/bookings/reschedule', { token, start })
              }
            >
              {t('Reschedule')}
            </button>
          </details>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
