'use client';
import { useAdminLanguage } from './AdminLanguage';
import { ScheduleEditor, ContactsEditor, ContentEditor } from './AdminEditors';
import { useCallback, useEffect, useState } from 'react';
import { copy, type Locale } from '@/lib/i18n';
import { defaultSchedule, defaultContacts } from '@/lib/defaults';
type Data = {
  bookings: {
    id: string;
    name: string;
    email: string;
    phone: string;
    comment: string;
    start: string;
    end: string;
    serviceId: string;
    status: string;
  }[];
  services: {
    id: string;
    price: number;
    priceType: string;
    duration: number;
    active: boolean;
    translations: Record<Locale, { name: string; description: string }>;
  }[];
  settings: { key: string; value: unknown }[];
  unsent: number;
  bookingCount: number;
  upcomingCount: number;
  page: number;
  pages: number;
};
export default function Admin() {
  const { t, locale: adminLocale } = useAdminLanguage();
  const [data, setData] = useState<Data>(),
    [tab, setTab] = useState('bookings'),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [locale, setLocale] = useState<Locale>('lv'),
    [filter, setFilter] = useState('upcoming'),
    [page, setPage] = useState(1);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin?page=${page}&filter=${filter}`);
      if (r.status === 401) {
        window.location.reload();
        return;
      }
      if (!r.ok) throw Error();
      setData(await r.json());
    } catch {
      setMessage(t('Unable to load data. Retry.'));
    }
  }, [page, filter, t]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(action: string, value: unknown) {
    setPending(true);
    setMessage('');
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: value }),
      });
      if (!r.ok) throw Error();
      setMessage(t('Saved successfully.'));
      await load();
    } catch {
      setMessage(
        t(
          'Unable to save. Check input. Cancelled bookings cannot be reopened.',
        ),
      );
    } finally {
      setPending(false);
    }
  }
  const setting = (key: string, fallback: unknown) =>
    data?.settings.find((s) => s.key === key)?.value ?? fallback;
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href="/lv" className="logo">
          TaxSolutions <small>/ admin</small>
        </a>
        <button
          className="button secondary small"
          onClick={async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.reload();
          }}
        >
          {t('Sign out')}
        </button>
      </header>
      <a className="button secondary small" href="/workspace">CRM / Planner →</a>
      <div className="admin-intro">
        <p className="section-label">{t('WORKSPACE')}</p>
        <h1>{t('Business overview')}</h1>
        <p>
          {data?.upcomingCount ?? '—'} {t('upcoming appointments')} ·{' '}
          {data?.unsent ?? '—'} {t('emails waiting for delivery')}
        </p>
      </div>
      <nav className="admin-tabs">
        {['bookings', 'services', 'schedule', 'contacts', 'content'].map(
          (name) => (
            <button
              key={name}
              className={tab === name ? 'selected' : ''}
              onClick={() => {
                setTab(name);
                setMessage('');
              }}
            >
              {t(name)}
            </button>
          ),
        )}
      </nav>
      <p role="status">{message}</p>
      {!data ? (
        <button onClick={load}>{t('Load / retry')}</button>
      ) : (
        <>
          {tab === 'bookings' && (
            <section className="admin-card">
              <div className="admin-toolbar">
                <h2>{t('Appointments')}</h2>
                <select
                  aria-label={t('Appointments')}
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="upcoming">{t('Upcoming')}</option>
                  <option value="all">{t('All')}</option>
                  <option value="PENDING">{t('Pending')}</option>
                  <option value="CONFIRMED">{t('Confirmed')}</option>
                  <option value="CANCELLED">{t('Cancelled')}</option>
                </select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Europe/Riga')}</th>
                      <th>{t('Client')}</th>
                      <th>{t('Service / notes')}</th>
                      <th>{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {new Intl.DateTimeFormat(adminLocale, {
                            timeZone: 'Europe/Riga',
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(b.start))}
                        </td>
                        <td>
                          <strong>{b.name}</strong>
                          <br />
                          {b.email}
                          <br />
                          {b.phone}
                        </td>
                        <td>
                          {data.services.find((s) => s.id === b.serviceId)
                            ?.translations[adminLocale].name ?? b.serviceId}
                          <p>{b.comment}</p>
                        </td>
                        <td>
                          <select
                            aria-label={`${t('Status')}: ${b.name}`}
                            value={b.status}
                            disabled={pending || b.status === 'CANCELLED'}
                            onChange={(e) =>
                              void save('status', {
                                id: b.id,
                                status: e.target.value,
                              })
                            }
                          >
                            {[
                              'PENDING',
                              'CONFIRMED',
                              'CANCELLED',
                              'COMPLETED',
                            ].map((s) => (
                              <option key={s} value={s}>
                                {t(s)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-pagination">
                <button
                  className="button secondary small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  {data.page} / {data.pages} · {data.bookingCount}
                </span>
                <button
                  className="button secondary small"
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            </section>
          )}
          {tab === 'services' && (
            <section>
              <button
                className="button small"
                disabled={pending}
                onClick={() =>
                  void save('service', {
                    id: `service-${Date.now()}`,
                    price: 0,
                    priceType: 'FIXED',
                    duration: 60,
                    active: false,
                    translations: {
                      lv: {
                        name: 'Jauns pakalpojums',
                        description: 'Pievienojiet aprakstu.',
                      },
                      en: {
                        name: 'New service',
                        description: 'Add a description.',
                      },
                      ru: {
                        name: 'Новая услуга',
                        description: 'Добавьте описание.',
                      },
                    },
                  })
                }
              >
                {t('Add service')}
              </button>
              <p>
                {t(
                  'Prices in cents (EUR). Durations in 30-minute increments. Existing appointments retain their reserved duration.',
                )}
              </p>
              {data.services.map((s) => (
                <form
                  className="admin-card"
                  key={s.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void save('service', {
                      ...s,
                      price: Number(f.get('price')),
                      priceType: f.get('priceType'),
                      duration: Number(f.get('duration')),
                      active: f.get('active') === 'on',
                      translations: Object.fromEntries(
                        ['lv', 'en', 'ru'].map((l) => [
                          l,
                          {
                            name: f.get(`${l}.name`),
                            description: f.get(`${l}.description`),
                          },
                        ]),
                      ),
                    });
                  }}
                >
                  <h2>{s.id}</h2>
                  <div className="form-grid">
                    {(['lv', 'en', 'ru'] as Locale[]).map((l) => (
                      <div key={l}>
                        <label>
                          {l.toUpperCase()} {t('name')}
                          <input
                            name={`${l}.name`}
                            defaultValue={s.translations[l].name}
                            required
                          />
                        </label>
                        <label>
                          {t('Description')}
                          <textarea
                            name={`${l}.description`}
                            defaultValue={s.translations[l].description}
                            required
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="form-grid">
                    <label>
                      {t('Price (EUR cents)')}
                      <input
                        type="number"
                        name="price"
                        min={0}
                        max={100000000}
                        defaultValue={s.price}
                        required
                      />
                    </label>
                    <label>
                      {t('Type')}
                      <select name="priceType" defaultValue={s.priceType}>
                        {['FIXED', 'FROM', 'HOURLY', 'MONTHLY'].map((kind) => (
                          <option key={kind} value={kind}>
                            {t(kind)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('Duration (minutes)')}
                      <input
                        type="number"
                        name="duration"
                        min={30}
                        max={240}
                        step={30}
                        defaultValue={s.duration}
                        required
                      />
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={s.active}
                      />
                      {t('Active')}
                    </label>
                  </div>
                  <button className="button small" disabled={pending}>
                    {t('Save service')}
                  </button>
                </form>
              ))}
            </section>
          )}
          {tab === 'schedule' && (
            <ScheduleEditor
              key={JSON.stringify(setting('schedule', defaultSchedule))}
              value={
                setting('schedule', defaultSchedule) as typeof defaultSchedule
              }
              pending={pending}
              onSave={(v) => save('schedule', v)}
            />
          )}
          {tab === 'contacts' && (
            <ContactsEditor
              key={JSON.stringify(setting('contacts', defaultContacts))}
              value={
                setting('contacts', defaultContacts) as typeof defaultContacts
              }
              pending={pending}
              onSave={(v) => save('contacts', v)}
            />
          )}
          {tab === 'content' && (
            <>
              <label>
                {t('Language')}
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  {['lv', 'en', 'ru'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <ContentEditor
                key={locale + JSON.stringify(setting(`content.${locale}`, {}))}
                value={{
                  ...copy[locale],
                  ...(setting(`content.${locale}`, {}) as object),
                }}
                pending={pending}
                onSave={(value) => save('content', { locale, value })}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
