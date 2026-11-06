'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import {
  calendarRange,
  CRM_TIMEZONE,
  moveCalendar,
  rigaInput,
  type CalendarMode,
} from '@/lib/v2/crm-calendar';
import type { Locale } from '@/lib/i18n';
type Event = {
  id: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  comment?: string;
  start?: string;
  end?: string;
  dueAt?: string;
  status: string;
  version: number;
  format?: string;
  priority?: string;
  service?: { translations: Record<Locale, { name: string }> };
  staff?: { name: string } | null;
  assigned?: { name: string } | null;
};
export default function CrmCalendar({
  t,
  locale,
  staff,
  revision,
  onSave,
}: {
  t: (key: string) => string;
  locale: Locale;
  staff: { id: string; name: string }[];
  revision: number;
  onSave: (action: string, data: unknown) => Promise<boolean>;
}) {
  const [anchor, setAnchor] = useState(
    formatInTimeZone(new Date(), CRM_TIMEZONE, 'yyyy-MM-dd'),
  );
  const [mode, setMode] = useState<CalendarMode>('month');
  const [kind, setKind] = useState('bookings'),
    [staffId, setStaff] = useState(''),
    [status, setStatus] = useState('');
  const [events, setEvents] = useState<Event[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [truncated, setTruncated] = useState(false),
    [retry, setRetry] = useState(0),
    [pending, setPending] = useState(false);
  const range = calendarRange(anchor, mode);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setEvents([]);
    const params = new URLSearchParams({
      view: 'calendar',
      date: anchor,
      mode,
      kind,
      staffId,
      status,
    });
    fetch(`/api/workspace?${params}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        setEvents(d.items);
        setTruncated(d.truncated);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('Request failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [anchor, mode, kind, staffId, status, revision, retry]);
  const current = events.find((e) => e.id === selected);
  const time = (value: string) =>
    formatInTimeZone(value, CRM_TIMEZONE, 'HH:mm');
  async function act(action: string, data: unknown) {
    setPending(true);
    try {
      if (await onSave(action, data)) setRetry((n) => n + 1);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="crm-calendar" aria-label={t('Calendar')}>
      <div className="admin-card crm-calendar-controls">
        <div className="crm-period">
          <button
            className="button secondary small"
            aria-label={t('Previous period')}
            onClick={() => setAnchor(moveCalendar(anchor, mode, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="button secondary small"
            onClick={() =>
              setAnchor(
                formatInTimeZone(new Date(), CRM_TIMEZONE, 'yyyy-MM-dd'),
              )
            }
          >
            {t('Today')}
          </button>
          <button
            className="button secondary small"
            aria-label={t('Next period')}
            onClick={() => setAnchor(moveCalendar(anchor, mode, 1))}
          >
            <ChevronRight size={18} />
          </button>
          <label>
            {t('Date')}
            <input
              type="date"
              min="2000-01-01"
              max="2099-12-31"
              value={anchor}
              onChange={(e) => {
                if (e.target.validity.valid && e.target.value)
                  setAnchor(e.target.value);
              }}
            />
          </label>
        </div>
        <div
          className="crm-segment"
          role="group"
          aria-label={t('Calendar view')}
        >
          {(['day', 'week', 'month'] as CalendarMode[]).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <div className="crm-calendar-filters">
          <label>
            {t('Category')}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setSelected(null);
                setStatus('');
              }}
            >
              <option value="bookings">{t('Bookings')}</option>
              <option value="tasks">{t('Tasks')}</option>
            </select>
          </label>
          <label>
            {t('Assignee')}
            <select value={staffId} onChange={(e) => setStaff(e.target.value)}>
              <option value="">{t('All')}</option>
              {staff.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Status')}
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('All')}</option>
              {(kind === 'tasks'
                ? ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
                : ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']
              ).map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="crm-timezone">
        <CalendarDays size={16} /> Europe/Riga ·{' '}
        {new Intl.DateTimeFormat(locale, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${anchor}T12:00Z`))}
      </p>
      {error && (
        <div role="alert" className="crm-feedback error">
          {t(error)}{' '}
          <button
            className="button secondary small"
            onClick={() => setRetry((n) => n + 1)}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      {loading && <p role="status">{t('Loading…')}</p>}
      {truncated && (
        <p role="status">
          {t('Too many events. Choose a shorter period or filter.')}
        </p>
      )}
      {!loading && !error && (
        <div
          className={`crm-calendar-grid crm-calendar-${mode}`}
          aria-label={t('Events')}
        >
          {range.days.map((day) => {
            const bounds = calendarRange(day, 'day');
            const rows = events.filter((event) =>
              event.dueAt
                ? event.dueAt >= bounds.start.toISOString() &&
                  event.dueAt < bounds.end.toISOString()
                : event.start! < bounds.end.toISOString() &&
                  event.end! > bounds.start.toISOString(),
            );
            const today =
              day === formatInTimeZone(new Date(), CRM_TIMEZONE, 'yyyy-MM-dd');
            return (
              <section
                className={`crm-calendar-day ${day.slice(0, 7) !== anchor.slice(0, 7) ? 'outside' : ''} ${today ? 'today' : ''}`}
                key={day}
                aria-label={day}
              >
                <button
                  className="crm-day-heading"
                  onClick={() => {
                    setAnchor(day);
                    setMode('day');
                  }}
                  aria-label={`${t('Open day')} ${day}`}
                >
                  <span>
                    {new Intl.DateTimeFormat(locale, {
                      weekday: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(`${day}T12:00Z`))}
                  </span>
                  <strong>{Number(day.slice(-2))}</strong>
                </button>
                <div className="crm-day-events">
                  {rows.map((event) => (
                    <button
                      key={event.id}
                      className={`crm-event status-${event.status}`}
                      aria-pressed={selected === event.id}
                      onClick={() => setSelected(event.id)}
                    >
                      <time>
                        {time(event.dueAt ?? event.start!)}
                        {event.end ? `–${time(event.end)}` : ''}
                      </time>
                      <strong>{event.title ?? event.name}</strong>
                      <span>
                        {event.service?.translations[locale]?.name ??
                          t(event.priority ?? event.status)}
                      </span>
                    </button>
                  ))}
                  {!rows.length && (
                    <span className="crm-day-empty">
                      {mode === 'day' ? t('No events in this period.') : '—'}
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {current && (
        <section
          className="admin-card crm-event-detail"
          aria-label={t('Appointment details')}
        >
          <div className="workspace-task-top">
            <h2>{current.title ?? current.name}</h2>
            <button
              className="button secondary small"
              aria-label={t('Close details')}
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            {current.service?.translations[locale]?.name} · {t(current.status)}
          </p>
          <p>
            {current.email} {current.phone}
          </p>
          <p className="plain-text">{current.comment}</p>
          <p>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: CRM_TIMEZONE,
            }).format(new Date(current.dueAt ?? current.start!))}{' '}
            · Europe/Riga
          </p>
          <p>{current.staff?.name ?? current.assigned?.name}</p>
          <div className="workspace-actions">
            <label>
              {t('Status')}
              <select
                aria-label={t('Event status')}
                value={current.status}
                disabled={
                  pending || ['CANCELLED', 'COMPLETED'].includes(current.status)
                }
                onChange={(e) =>
                  void act(
                    kind === 'tasks' ? 'taskStatus' : 'bookingStatus',
                    kind === 'tasks'
                      ? {
                          id: current.id,
                          version: current.version,
                          status: e.target.value,
                        }
                      : { id: current.id, status: e.target.value },
                  )
                }
              >
                {(kind === 'tasks'
                  ? ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
                  : ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']
                ).map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {kind === 'bookings' &&
            !['CANCELLED', 'COMPLETED'].includes(current.status) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    const start = rigaInput(
                      String(new FormData(e.currentTarget).get('start')),
                    );
                    void act('reschedule', { id: current.id, start });
                  } catch {
                    setError('Invalid local time. Choose another time.');
                  }
                }}
              >
                <label>
                  {t('Reschedule')} · Europe/Riga
                  <input
                    key={current.start}
                    type="datetime-local"
                    name="start"
                    defaultValue={formatInTimeZone(
                      current.start!,
                      CRM_TIMEZONE,
                      "yyyy-MM-dd'T'HH:mm",
                    )}
                    required
                  />
                </label>
                <button className="button small" disabled={pending}>
                  {t('Reschedule')}
                </button>
              </form>
            )}
        </section>
      )}
    </section>
  );
}
