'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { useAdminLanguage } from './AdminLanguage';
import { workspaceLabel } from '@/lib/v2/ui';
import type { Actor } from '@/lib/v2/policy';
import CrmShell from './CrmShell';
import CrmCalendar from './CrmCalendar';
import Admin from './Admin';
import { ScheduleEditor } from './AdminEditors';
import { defaultSchedule } from '@/lib/defaults';
type Row = Record<string, unknown>;
type Snapshot = {
  items?: Row[];
  connections?: Row[];
  total?: number;
  page?: number;
  [key: string]: unknown;
};
const str = (r: Row | undefined, key: string) => String(r?.[key] ?? '');
function fields(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}
export default function Workspace({ actor }: { actor: Actor }) {
  const { locale, t: adminT } = useAdminLanguage();
  const router = useRouter();
  const t = useCallback((s: string) => workspaceLabel(s, locale), [locale]);
  const privileged = actor.role !== 'ACCOUNTANT';
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const settingsView = ['services', 'schedule', 'contacts', 'content'];
  const [view, setView] = useState('dashboard'),
    [data, setData] = useState<Snapshot>({}),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [staff, setStaff] = useState<Row[]>([]),
    [clients, setClients] = useState<Row[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Row | null>(null),
    [mode, setMode] = useState('List'),
    [revision, setRevision] = useState(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (
        ['calendar', 'services', 'schedule', 'contacts', 'content'].includes(
          view,
        )
      ) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      try {
        const r = await fetch(
          `/api/workspace?view=${view}&page=${page}&q=${encodeURIComponent(query)}&status=${status}`,
          { signal },
        );
        if (r.status === 401) {
          router.replace('/admin');
          return;
        }
        if (!r.ok) throw Error();
        setData(await r.json());
      } catch {
        if (!signal?.aborted) {
          setLoadError(true);
          setData({});
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view, page, query, status, router],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/workspace?view=staff', { signal: controller.signal }).then(
        (r) => r.json(),
      ),
      fetch('/api/workspace?view=clients', { signal: controller.signal }).then(
        (r) => r.json(),
      ),
    ])
      .then(([a, b]) => {
        setStaff(a.items ?? []);
        setClients(b.items ?? []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [revision]);
  async function save(action: string, value: unknown) {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: value }),
      });
      const result = await r.json();
      if (!r.ok) {
        setMessage(
          t(
            r.status === 409
              ? 'Version conflict. Reload and try again.'
              : 'Request failed',
          ),
        );
        return false;
      }
      setMessage(
        result.enrollmentUrl
          ? `${t('Enrollment link (share securely)')}: ${result.enrollmentUrl}`
          : t('Saved'),
      );
      setEditing(null);
      setRevision((v) => v + 1);
      return true;
    } catch {
      setMessage(t('Request failed'));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const date = (value: unknown) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Riga',
    }).format(new Date(String(value)));
  function field(
    name: string,
    label: string,
    row: Row = {},
    type = 'text',
    required = true,
  ) {
    return (
      <label>
        {t(label)}
        <input
          name={name}
          type={type}
          defaultValue={str(row, name)}
          required={required}
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: { id: string; name: string }[],
    row: Row = {},
    blank = true,
  ) {
    return (
      <label>
        {t(label)}
        <select name={name} defaultValue={str(row, name)}>
          {blank && <option value="">—</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const enums = (values: string[]) => values.map((id) => ({ id, name: t(id) }));
  const staffOptions = staff
    .filter((r) => r.active)
    .map((r) => ({ id: str(r, 'id'), name: str(r, 'name') }));
  const clientOptions = clients.map((r) => ({
    id: str(r, 'id'),
    name: str(r, 'name'),
  }));
  const rows = data.items ?? [];
  function taskCard(row: Row) {
    const comments = (row.comments ?? []) as Row[];
    return (
      <article className="workspace-task" key={str(row, 'id')}>
        <div className="workspace-task-top">
          <strong>{str(row, 'title')}</strong>
          <span className={`priority priority-${str(row, 'priority')}`}>
            {t(str(row, 'priority'))}
          </span>
        </div>
        <p>
          {date(row.dueAt)} · {t(str(row, 'status'))}
        </p>
        <p>
          {String((row.assigned as Row | undefined)?.name ?? t('Unassigned'))}
        </p>
        <div className="workspace-actions">
          <select
            aria-label={`${t('Status')}: ${str(row, 'title')}`}
            value={str(row, 'status')}
            disabled={busy}
            onChange={(e) =>
              void save('taskStatus', {
                id: row.id,
                version: row.version,
                status: e.target.value,
              })
            }
          >
            {enums(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).map((o) => (
              <option value={o.id} key={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {privileged && (
            <button
              className="button secondary small"
              onClick={() => setEditing(row)}
            >
              {t('Edit')}
            </button>
          )}
        </div>
        <details>
          <summary>{t('Details')}</summary>
          <p>{str(row, 'description')}</p>
          <small>ID: {str(row, 'id')}</small>
          <ul className="task-comments">
            {comments.map((c) => (
              <li key={str(c, 'id')}>
                {str(c, 'body')}
                <small>{date(c.createdAt)}</small>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              void save('comment', {
                taskId: row.id,
                body: new FormData(form).get('body'),
              }).then((ok) => {
                if (ok) form.reset();
              });
            }}
          >
            <label>
              {t('Comment')}
              <textarea name="body" maxLength={2000} required />
            </label>
            <button className="button small" disabled={busy}>
              {t('Add comment')}
            </button>
          </form>
          <TaskHistory id={str(row, 'id')} t={t} />
        </details>
      </article>
    );
  }
  return (
    <CrmShell
      view={view}
      role={actor.role}
      privileged={privileged}
      onNavigate={(key) => {
        setView(key);
        setPage(1);
        setStatus('');
        setQuery('');
        setEditing(null);
        setMessage('');
        setData({});
      }}
    >
      <div className="admin-intro">
        <p className="section-label">
          {t('WORKSPACE')} · {t(actor.role)}
        </p>
        <h1>
          {settingsView.includes(view)
            ? adminT(view)
            : view === 'dashboard'
              ? adminT('Business overview')
              : t(
                  view === 'dashboard'
                    ? 'Business overview'
                    : view === 'clients'
                      ? 'Clients'
                      : view === 'tasks'
                        ? 'Tasks'
                        : view === 'bookings'
                          ? 'Bookings'
                          : view === 'staff'
                            ? 'Staff'
                            : view === 'inquiries'
                              ? 'Inquiries'
                              : view === 'calendar'
                                ? 'Calendar'
                                : view === 'faq'
                                  ? 'FAQ'
                                  : view === 'audit'
                                    ? 'Audit'
                                    : 'Video',
                )}
        </h1>
        <p>{t('No financial documents or passport details.')}</p>
      </div>
      <p role="status" className="workspace-message">
        {message}
      </p>
      {loading && (
        <p role="status" className="crm-loading">
          {t('Loading…')}
        </p>
      )}
      {loadError && (
        <div role="alert" className="crm-feedback error">
          {t('Request failed')}{' '}
          <button
            className="button secondary small"
            onClick={() => void load()}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      {settingsView.includes(view) && privileged && (
        <Admin key={view} embedded initialTab={view} />
      )}
      {!loading &&
        !loadError &&
        [
          'tasks',
          'clients',
          'bookings',
          'inquiries',
          'staff',
          'faq',
          'audit',
          'video',
        ].includes(view) &&
        !data.items?.length && (
          <div className="crm-empty">
            <h2>{t('No records yet')}</h2>
            <p>{t('Change filters or add a record to get started.')}</p>
          </div>
        )}
      {view === 'dashboard' && (
        <div className="workspace-metrics">
          {[
            ['newBookings', 'New bookings'],
            ['upcoming', 'Upcoming'],
            ['today', 'Tasks today'],
            ['overdue', 'Overdue'],
            ['clients', 'Clients'],
            ['unassigned', 'Unassigned'],
            ['failedVideo', 'Video issues'],
            ['failedMail', 'Email issues'],
          ].map(([key, label]) => (
            <article className="admin-card" key={key}>
              <p>{t(label)}</p>
              <strong>{String(data[key] ?? '—')}</strong>
            </article>
          ))}
        </div>
      )}
      {view === 'dashboard' && !loading && !loadError && (
        <>
          <p className="crm-asof">
            {t('Updated')}: {data.asOf ? date(data.asOf) : '—'} · Europe/Riga
          </p>
          <div className="crm-dashboard-lists">
            {[
              ['nextBookings', 'Upcoming consultations', 'bookings'],
              ['dueTasks', 'Due tasks', 'tasks'],
            ].map(([key, label, target]) => (
              <section className="admin-card" key={key}>
                <div className="workspace-task-top">
                  <h2>{t(label)}</h2>
                  <button
                    className="button secondary small"
                    onClick={() => {
                      setView(target);
                      setData({});
                    }}
                  >
                    {t('View all')}
                  </button>
                </div>
                {!(data[key] as Row[] | undefined)?.length ? (
                  <p>{t('No records yet')}</p>
                ) : (
                  <ul className="crm-agenda">
                    {(data[key] as Row[]).map((row) => (
                      <li key={str(row, 'id')}>
                        <strong>
                          {str(row, key === 'nextBookings' ? 'name' : 'title')}
                        </strong>
                        <span>{date(row.start ?? row.dueAt)}</span>
                        <span className="crm-badge">
                          {t(str(row, 'status'))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {view === 'calendar' && (
        <CrmCalendar
          t={t}
          locale={locale}
          staff={staffOptions}
          revision={revision}
          onSave={save}
        />
      )}
      {['tasks', 'clients', 'bookings', 'inquiries'].includes(view) && (
        <div className="workspace-toolbar">
          <label>
            {t('Search')}
            <input
              type="search"
              maxLength={120}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {view !== 'inquiries' && (
            <label>
              {t('Status')}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">—</option>
                {enums(
                  view === 'tasks'
                    ? ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'overdue']
                    : view === 'clients'
                      ? ['NEW', 'ACTIVE', 'CLOSED']
                      : ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
                ).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id === 'overdue' ? t('Overdue') : o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {privileged && ['tasks', 'clients'].includes(view) && (
            <button className="button small" onClick={() => setEditing({})}>
              {t('Add')}
            </button>
          )}
          {view === 'tasks' && (
            <select
              aria-label={t('List')}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {['List', 'Kanban'].map((m) => (
                <option key={m} value={m}>
                  {t(m)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {view === 'tasks' &&
        (mode === 'Kanban' ? (
          <div className="kanban">
            {['TODO', 'IN_PROGRESS', 'DONE'].map((s) => (
              <section key={s}>
                <h2>{t(s)}</h2>
                {rows.filter((r) => r.status === s).map(taskCard)}
              </section>
            ))}
          </div>
        ) : (
          <div className="workspace-task-list">{rows.map(taskCard)}</div>
        ))}
      {view === 'clients' && (
        <div className="workspace-records">
          {rows.map((row) => (
            <article className="admin-card" key={str(row, 'id')}>
              <h2>{str(row, 'name')}</h2>
              <p>
                {str(row, 'email')} · {str(row, 'phone')} ·{' '}
                {t(str(row, 'status'))}
              </p>
              <div className="workspace-actions">
                {privileged && (
                  <button
                    className="button secondary small"
                    onClick={() => setEditing(row)}
                  >
                    {t('Edit')}
                  </button>
                )}
                {actor.role === 'OWNER' && (
                  <>
                    <a
                      className="button secondary small"
                      href={`/api/workspace/export?clientId=${row.id}`}
                    >
                      {t('Export personal data')}
                    </a>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save('eraseClient', {
                          id: row.id,
                          confirmEmail: new FormData(e.currentTarget).get(
                            'confirmEmail',
                          ),
                        });
                      }}
                    >
                      <label>
                        {t('Confirm email to erase')}
                        <input name="confirmEmail" type="email" required />
                      </label>
                      <button
                        className="button secondary small"
                        disabled={busy}
                      >
                        {t('Erase personal data')}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {view === 'inquiries' &&
        rows.map((row) => (
          <article className="admin-card" key={str(row, 'id')}>
            <h2>{str(row, 'name')}</h2>
            <p>
              {str(row, 'email')} · {date(row.createdAt)}
            </p>
            <p className="plain-text">{str(row, 'message')}</p>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const f = fields(e.currentTarget);
                void save('inquiry', {
                  id: row.id,
                  status: f.status,
                  assignedId: privileged
                    ? f.assignedId || null
                    : row.assignedId,
                });
              }}
            >
              {select(
                'status',
                'Status',
                enums(['NEW', 'ASSIGNED', 'CLOSED']),
                row,
                false,
              )}
              {privileged &&
                select('assignedId', 'Assignee', staffOptions, row)}
              <button className="button small" disabled={busy}>
                {t('Save')}
              </button>
            </form>
          </article>
        ))}
      {view === 'bookings' && (
        <>
          <p>{t('Online confirmation waits for a working video link.')}</p>
          {rows.map((row) => (
            <article className="admin-card" key={str(row, 'id')}>
              <div className="workspace-task-top">
                <h2>{str(row, 'name')}</h2>
                <strong>{t(str(row, 'status'))}</strong>
              </div>
              <p>
                {date(row.start)} · {str(row, 'serviceId')} ·{' '}
                {t(str(row, 'format'))}
              </p>
              <p>
                {str(row, 'email')} · {str(row, 'phone')}
              </p>
              <details>
                <summary>{t('Comment')}</summary>
                <p className="plain-text">{str(row, 'comment')}</p>
              </details>
              <div className="workspace-actions">
                {['PENDING', 'CONFIRMED'].includes(str(row, 'status')) && (
                  <>
                    {row.status === 'PENDING' && (
                      <button
                        className="button small"
                        disabled={busy}
                        onClick={() =>
                          void save('bookingStatus', {
                            id: row.id,
                            status: 'CONFIRMED',
                          })
                        }
                      >
                        {t('Confirm')}
                      </button>
                    )}
                    <button
                      className="button secondary small"
                      disabled={busy}
                      onClick={() =>
                        void save('bookingStatus', {
                          id: row.id,
                          status: 'CANCELLED',
                        })
                      }
                    >
                      {t('Cancel')}
                    </button>
                    {new Date(str(row, 'end')) < new Date() && (
                      <button
                        className="button secondary small"
                        onClick={() =>
                          void save('bookingStatus', {
                            id: row.id,
                            status: 'COMPLETED',
                          })
                        }
                      >
                        {t('Complete')}
                      </button>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = fields(e.currentTarget);
                        void save('reschedule', {
                          id: row.id,
                          start: fromZonedTime(
                            String(f.start),
                            'Europe/Riga',
                          ).toISOString(),
                          ...(privileged && f.staffId
                            ? { staffId: f.staffId }
                            : {}),
                        });
                      }}
                    >
                      <label>
                        {t('Time (Riga)')}
                        <input type="datetime-local" name="start" required />
                      </label>
                      {privileged &&
                        row.status === 'PENDING' &&
                        select('staffId', 'Assignee', staffOptions, row)}
                      <button
                        className="button secondary small"
                        disabled={busy}
                      >
                        {t('Reschedule')}
                      </button>
                    </form>
                  </>
                )}
                {privileged && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save('linkClient', {
                        bookingId: row.id,
                        clientId: new FormData(e.currentTarget).get('clientId'),
                      });
                    }}
                  >
                    {select('clientId', 'Client', clientOptions, row)}
                    <button className="button secondary small" disabled={busy}>
                      {t('Link client')}
                    </button>
                  </form>
                )}
                {(row.meeting as Row | undefined)?.status === 'READY' && (
                  <button
                    className="button secondary small"
                    onClick={async () => {
                      const r = await fetch(
                        `/api/workspace/video-link?bookingId=${row.id}`,
                      );
                      if (r.ok) {
                        const d = await r.json();
                        window.open(d.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {t('Video')} ↗
                  </button>
                )}
              </div>
              {Boolean(row.meeting) && (
                <p>
                  {t('Video')}: {str(row.meeting as Row, 'status')}
                </p>
              )}
            </article>
          ))}
        </>
      )}
      {view === 'staff' && (
        <>
          {actor.role === 'OWNER' && (
            <button
              className="button small"
              onClick={() => setEditing({ invite: true })}
            >
              {t('Invite staff')}
            </button>
          )}
          {rows.map((row) => (
            <article className="admin-card" key={str(row, 'id')}>
              <h2>{str(row, 'name')}</h2>
              <p>
                {str(row, 'email')} · {t(str(row, 'role'))} ·{' '}
                {row.active ? '✓' : '—'}
              </p>
              <p>
                {(row.specializations as string[]).join(', ')} ·{' '}
                {str(row, 'capacityMinutes')}
              </p>
              {actor.role === 'OWNER' && (
                <>
                  <button
                    className="button secondary small"
                    onClick={() => setEditing(row)}
                  >
                    {t('Edit')}
                  </button>
                  <details>
                    <summary>{t('Staff schedule')}</summary>
                    <button
                      className="button secondary small"
                      disabled={busy}
                      onClick={() =>
                        void save('staff', { ...row, schedule: null })
                      }
                    >
                      {t('Use shared schedule')}
                    </button>
                    <ScheduleEditor
                      value={
                        (row.schedule as typeof defaultSchedule) ??
                        defaultSchedule
                      }
                      pending={busy}
                      onSave={(v) =>
                        save('staff', { ...row, schedule: v }).then(() => {})
                      }
                    />
                  </details>
                </>
              )}
            </article>
          ))}
        </>
      )}
      {view === 'faq' && (
        <>
          {privileged && (
            <button
              className="button small"
              onClick={() =>
                setEditing({
                  translations: {
                    lv: { question: '', answer: '' },
                    en: { question: '', answer: '' },
                    ru: { question: '', answer: '' },
                  },
                })
              }
            >
              {t('Add')}
            </button>
          )}
          {rows.map((row) => (
            <article className="admin-card" key={str(row, 'id')}>
              <h2>
                {str(
                  (row.translations as Record<string, Row>)[locale],
                  'question',
                )}
              </h2>
              <p>
                {str(
                  (row.translations as Record<string, Row>)[locale],
                  'answer',
                )}
              </p>
              <p>
                {str(row, 'category')} · {t('Approved')}:{' '}
                {row.approved ? '✓' : '—'}
              </p>
              {privileged && (
                <button
                  className="button secondary small"
                  onClick={() => setEditing(row)}
                >
                  {t('Edit')}
                </button>
              )}
            </article>
          ))}
        </>
      )}
      {view === 'audit' && (
        <div className="admin-card table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('Time (Riga)')}</th>
                <th>{t('Role')}</th>
                <th>{t('History')}</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={str(row, 'id')}>
                  <td>{date(row.createdAt)}</td>
                  <td>{str(row, 'actorRole')}</td>
                  <td>
                    {str(row, 'action')} · {(row.fields as string[]).join(', ')}
                  </td>
                  <td>{str(row, 'objectId')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === 'video' && (
        <>
          <div className="admin-card">
            <h2>Google Meet · Microsoft Teams · Zoom</h2>
            <p>{t('Online confirmation waits for a working video link.')}</p>
            <div className="workspace-actions">
              {['google', 'microsoft', 'zoom'].map((provider) => (
                <button
                  className="button secondary small"
                  key={provider}
                  onClick={async () => {
                    const r = await fetch(`/api/oauth/${provider}/start`, {
                      method: 'POST',
                    });
                    if (r.ok) location.href = (await r.json()).url;
                    else
                      setMessage(
                        t('Connection is disabled or not configured.'),
                      );
                  }}
                >
                  {t('Connect')} {provider}
                </button>
              ))}
            </div>
            {(data.connections ?? []).map((c) => (
              <p key={str(c, 'id')}>
                {str(c, 'provider')} · {str(c, 'staffId')}{' '}
                <button
                  className="button secondary small"
                  onClick={() => void save('disconnectOAuth', { id: c.id })}
                >
                  {t('Disconnect')}
                </button>
              </p>
            ))}
          </div>
          {rows.map((row) => (
            <article className="admin-card" key={str(row, 'id')}>
              <h3>
                {str(row, 'provider')} · {str(row, 'status')}
              </h3>
              <p>
                ID: {str(row, 'bookingId')} · {str(row, 'errorCode')}
              </p>
              {privileged && row.status === 'FAILED' && (
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => void save('retryVideo', { id: row.id })}
                >
                  {t('Retry')}
                </button>
              )}
            </article>
          ))}
        </>
      )}
      {view !== 'dashboard' && view !== 'calendar' && (
        <div className="admin-pagination">
          <button
            className="button secondary small"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← {t('Previous')}
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil((data.total ?? 0) / 50))}
          </span>
          <button
            className="button secondary small"
            disabled={page * 50 >= (data.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('Next')} →
          </button>
        </div>
      )}
      {editing && (
        <section className="admin-card workspace-editor" aria-label={t('Edit')}>
          <button
            className="button secondary small"
            onClick={() => setEditing(null)}
          >
            {t('Cancel')}
          </button>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const f = fields(e.currentTarget);
              if (view === 'clients')
                void save('client', {
                  ...f,
                  id: editing.id,
                  ownerId: f.ownerId || null,
                });
              if (view === 'tasks')
                void save('task', {
                  ...f,
                  id: editing.id,
                  version: editing.version,
                  dueAt: fromZonedTime(
                    String(f.dueAt),
                    'Europe/Riga',
                  ).toISOString(),
                  hardDeadline: f.hardDeadline === 'on',
                  autoAssign: f.autoAssign === 'on',
                  estimatedMinutes: Number(f.estimatedMinutes),
                  assignedId: f.assignedId || null,
                  clientId: f.clientId || null,
                  bookingId: editing.bookingId ?? null,
                });
              if (view === 'staff') {
                if (editing.invite) void save('inviteStaff', f);
                else
                  void save('staff', {
                    ...editing,
                    ...f,
                    active: f.active === 'on',
                    acceptsBookings: f.acceptsBookings === 'on',
                    capacityMinutes: Number(f.capacityMinutes),
                    specializations: String(f.specializations)
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  });
              }
              if (view === 'faq')
                void save('faq', {
                  id: editing.id,
                  category: f.category,
                  approved: f.approved === 'on',
                  translations: Object.fromEntries(
                    ['lv', 'en', 'ru'].map((l) => [
                      l,
                      {
                        question: f[`${l}.question`],
                        answer: f[`${l}.answer`],
                      },
                    ]),
                  ),
                });
            }}
          >
            <div className="form-grid">
              {view === 'clients' && (
                <>
                  {field('name', 'Name', editing)}
                  {field('email', 'Email', editing, 'email')}
                  {field('phone', 'Phone', editing, 'tel', false)}
                  {select(
                    'locale',
                    'Language',
                    enums(['lv', 'en', 'ru']),
                    editing,
                    false,
                  )}
                  {select(
                    'status',
                    'Status',
                    enums(['NEW', 'ACTIVE', 'CLOSED']),
                    editing,
                    false,
                  )}
                  {select('ownerId', 'Owner', staffOptions, editing)}
                </>
              )}
              {view === 'tasks' && (
                <>
                  {field('title', 'Title', editing)}
                  <label>
                    {t('Description')}
                    <textarea
                      name="description"
                      defaultValue={str(editing, 'description')}
                      maxLength={4000}
                    />
                  </label>
                  {select(
                    'status',
                    'Status',
                    enums(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
                    editing,
                    false,
                  )}
                  {select(
                    'priority',
                    'Priority',
                    enums(['NORMAL', 'LOW', 'HIGH', 'URGENT']),
                    editing,
                    false,
                  )}
                  <label>
                    {t('Due date (Riga)')}
                    <input
                      type="datetime-local"
                      name="dueAt"
                      defaultValue={
                        editing.dueAt
                          ? formatInTimeZone(
                              new Date(str(editing, 'dueAt')),
                              'Europe/Riga',
                              "yyyy-MM-dd'T'HH:mm",
                            )
                          : ''
                      }
                      required
                    />
                  </label>
                  {field(
                    'category',
                    'Category',
                    editing.id ? editing : { category: 'general' },
                  )}
                  {field(
                    'estimatedMinutes',
                    'Estimated minutes',
                    editing.id ? editing : { estimatedMinutes: 60 },
                    'number',
                  )}
                  {select(
                    'recurrence',
                    'Recurrence',
                    enums(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']),
                    editing,
                    false,
                  )}
                  {select('assignedId', 'Assignee', staffOptions, editing)}
                  {select('clientId', 'Client', clientOptions, editing)}
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="hardDeadline"
                      defaultChecked={editing.hardDeadline !== false}
                    />
                    {t('Hard deadline')}
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" name="autoAssign" />
                    {t('Auto assign')}
                  </label>
                  <p>{t('Auto assignment never changes deadlines.')}</p>
                </>
              )}
              {view === 'staff' && (
                <>
                  {field('name', 'Name', editing)}
                  {editing.invite && field('email', 'Email', editing, 'email')}
                  {select(
                    'role',
                    'Role',
                    enums(['ACCOUNTANT', 'ADMIN', 'OWNER']),
                    editing,
                    false,
                  )}
                  {select(
                    'locale',
                    'Language',
                    enums(['lv', 'en', 'ru']),
                    editing,
                    false,
                  )}
                  {!editing.invite && (
                    <>
                      {field(
                        'capacityMinutes',
                        'Capacity (minutes/week)',
                        editing,
                        'number',
                      )}
                      {field('specializations', 'Specializations', {
                        specializations: (
                          editing.specializations as string[]
                        ).join(', '),
                      })}
                      <label className="checkbox">
                        <input
                          name="active"
                          type="checkbox"
                          defaultChecked={Boolean(editing.active)}
                        />
                        {t('Active')}
                      </label>
                      <label className="checkbox">
                        <input
                          name="acceptsBookings"
                          type="checkbox"
                          defaultChecked={Boolean(editing.acceptsBookings)}
                        />
                        {t('Accept bookings')}
                      </label>
                    </>
                  )}
                </>
              )}
              {view === 'faq' && (
                <>
                  <label>
                    {t('Category')}
                    <select
                      name="category"
                      defaultValue={String(editing.category ?? 'general')}
                    >
                      {[
                        'general',
                        'accounting',
                        'tax',
                        'payroll',
                        'annual',
                        'registration',
                      ].map((category) => (
                        <option key={category} value={category}>
                          {t(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="approved"
                      defaultChecked={Boolean(editing.approved)}
                    />
                    {t('Approved')}
                  </label>
                  {['lv', 'en', 'ru'].map((l) => {
                    const v = (editing.translations as Record<string, Row>)[l];
                    return (
                      <fieldset className="admin-fieldset" key={l}>
                        <legend>{l.toUpperCase()}</legend>
                        {field(`${l}.question`, 'Question', {
                          [`${l}.question`]: v.question,
                        })}
                        <label>
                          {t('Answer')}
                          <textarea
                            name={`${l}.answer`}
                            defaultValue={str(v, 'answer')}
                            required
                            maxLength={3000}
                          />
                        </label>
                      </fieldset>
                    );
                  })}
                </>
              )}
            </div>
            <button className="button" disabled={busy}>
              {t('Save')}
            </button>
          </form>
        </section>
      )}
    </CrmShell>
  );
}
function TaskHistory({ id, t }: { id: string; t: (s: string) => string }) {
  const [rows, setRows] = useState<Row[]>([]);
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open)
          fetch(`/api/workspace/task-history?id=${id}`)
            .then((r) => (r.ok ? r.json() : []))
            .then(setRows)
            .catch(() => {});
      }}
    >
      <summary>{t('History')}</summary>
      {rows.map((r) => (
        <p key={str(r, 'id')}>
          {str(r, 'createdAt')} · {str(r, 'action')} ·{' '}
          {(r.fields as string[]).join(', ')}
        </p>
      ))}
    </details>
  );
}
