'use client';
import Calendar from './Calendar';
import { googleCalendarLink } from '@/lib/calendar-export';
import { useEffect, useState } from 'react';
import { workspaceLabel } from '@/lib/v2/ui';
import type { Copy, Locale } from '@/lib/i18n';
import type { Translations } from '@/lib/defaults';
type Service = { id: string; translations: Translations; duration: number };
export default function BookingForm({
  services,
  c,
  locale,
}: {
  services: Service[];
  c: Copy;
  locale: Locale;
}) {
  const [staffId, setStaff] = useState(''),
    [staff, setStaffList] = useState<{ id: string; name: string }[]>([]),
    [format, setFormat] = useState('IN_PERSON');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/staff', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then(setStaffList)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [serviceId, setService] = useState(services[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [cancelToken, setToken] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setSlots([]);
    setStart('');
    if (!date || !serviceId) return;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    fetch(
      `/api/availability?date=${date}&serviceId=${serviceId}${staffId ? `&staffId=${staffId}` : ''}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => setSlots(d.slots))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(c.error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, serviceId, staffId, c.error, version]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const payload = {
      serviceId,
      staffId: staffId || undefined,
      format,
      start,
      locale,
      name: f.get('name'),
      email: f.get('email'),
      phone: f.get('phone'),
      comment: f.get('comment'),
      consent: f.get('consent') === 'on',
      website: f.get('website'),
    };
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(
          r.status === 409
            ? c.conflict
            : r.status === 429
              ? c.rate
              : r.status === 400
                ? c.invalid
                : c.error,
        );
        if (r.status === 409) setVersion((v) => v + 1);
      } else setToken(d.cancelToken);
    } catch {
      setError(c.error);
    } finally {
      setPending(false);
    }
  }
  const selectedService = services.find((s) => s.id === serviceId);
  if (cancelToken)
    return (
      <div className="success-box" role="status">
        <span className="success-icon">✓</span>
        <h3>{c.success}</h3>
        <a
          className="button secondary"
          href={`/${locale}/cancel?token=${cancelToken}`}
        >
          {c.cancel} ↗
        </a>
        <div className="calendar-export">
          <a href={`/api/bookings/calendar?token=${cancelToken}`}>
            {locale === 'lv'
              ? 'Pievienot kalendāram'
              : locale === 'ru'
                ? 'Добавить в календарь'
                : 'Add to calendar'}{' '}
            (.ics)
          </a>
          <a
            target="_blank"
            rel="noreferrer"
            href={googleCalendarLink({
              title:
                selectedService?.translations[locale].name ?? 'TaxSolutions',
              start: new Date(start),
              end: new Date(
                new Date(start).getTime() +
                  (selectedService?.duration ?? 60) * 60000,
              ),
            })}
          >
            Google Calendar ↗
          </a>
        </div>
      </div>
    );
  return (
    <form onSubmit={submit} className="booking-form">
      <div className="form-grid">
        <label>
          {locale === 'lv'
            ? 'Grāmatvedis'
            : locale === 'ru'
              ? 'Специалист'
              : 'Accountant'}
          <select
            value={staffId}
            onChange={(e) => {
              setStaff(e.target.value);
              if (!e.target.value) setFormat('IN_PERSON');
            }}
          >
            <option value="">TaxSolutions</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {locale === 'lv'
            ? 'Konsultācijas formāts'
            : locale === 'ru'
              ? 'Формат консультации'
              : 'Consultation format'}
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="IN_PERSON">
              {workspaceLabel('IN_PERSON', locale)}
            </option>
            <option value="ONLINE" disabled={!staffId}>
              {workspaceLabel('ONLINE', locale)}
            </option>
          </select>
        </label>
      </div>
      <p className="form-hint">
        {workspaceLabel('No financial documents or passport details.', locale)}
      </p>

      <div className="form-step">
        <span className="step-number">01</span>
        <label>
          {c.service}
          <select
            value={serviceId}
            onChange={(e) => setService(e.target.value)}
            required
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.translations[locale].name} · {s.duration} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-step">
        <span className="step-number">02</span>
        <div className="grow">
          <div>
            <span className="field-label">{c.date}</span>
            <Calendar
              value={date}
              onChange={setDate}
              serviceId={serviceId}
              staffId={staffId || undefined}
              locale={locale}
              c={c}
              version={version}
            />
          </div>
          <fieldset className="time-field">
            <legend>{c.time} · Europe/Riga</legend>
            {loading ? (
              <p role="status">{c.loading}</p>
            ) : (
              <div className="time-slots">
                {slots.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={s === start ? 'selected' : ''}
                    aria-pressed={s === start}
                    onClick={() => setStart(s)}
                  >
                    {new Intl.DateTimeFormat(locale, {
                      timeZone: 'Europe/Riga',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }).format(new Date(s))}
                  </button>
                ))}
                {!slots.length && date && <p>{c.noSlots}</p>}
              </div>
            )}
          </fieldset>
        </div>
      </div>
      <div className="form-step">
        <span className="step-number">03</span>
        <div className="grow form-grid">
          <label>
            {c.name}
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            {c.email}
            <input
              type="email"
              name="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="full">
            {c.phone}
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              pattern="[+()0-9 .\-]{6,30}"
              required
            />
          </label>
          <label className="full">
            {c.comment}
            <textarea name="comment" maxLength={2000} rows={3} />
          </label>
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="checkbox full">
            <input name="consent" type="checkbox" required />
            <span>
              {c.consent}{' '}
              <a href={`/${locale}/privacy`} target="_blank" rel="noreferrer">
                {c.privacy} ↗
              </a>
            </span>
          </label>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="button submit-button" disabled={!start || pending}>
        {pending ? c.loading : c.submit}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
