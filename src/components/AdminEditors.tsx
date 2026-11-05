'use client';
import { useState } from 'react';
import { useAdminLanguage } from './AdminLanguage';
import {
  defaultSchedule,
  defaultContacts,
  type Schedule,
} from '@/lib/defaults';
import type { Copy } from '@/lib/i18n';
type SaveProps = {
  pending: boolean;
  onSave: (value: unknown) => Promise<void>;
};
export function ScheduleEditor({
  value,
  pending,
  onSave,
}: SaveProps & { value: Schedule }) {
  const { t, locale } = useAdminLanguage();
  const [rules, setRules] = useState(value),
    [closed, setClosed] = useState(''),
    [open, setOpen] = useState('');
  const update = (key: keyof Schedule, value: unknown) =>
    setRules((s) => ({ ...s, [key]: value }));
  return (
    <form
      className="admin-card"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(rules);
      }}
    >
      <h2>{t('Availability · Europe/Riga')}</h2>
      <p>
        {t('Existing appointments remain valid. Closed dates take priority.')}
      </p>
      <div className="form-grid">
        <label>
          {t('Opening hour')}
          <input
            type="number"
            min={0}
            max={23}
            value={rules.start}
            onChange={(e) => update('start', Number(e.target.value))}
            required
          />
        </label>
        <label>
          {t('Closing hour')}
          <input
            type="number"
            min={rules.start + 1}
            max={24}
            value={rules.end}
            onChange={(e) => update('end', Number(e.target.value))}
            required
          />
        </label>
        <label>
          {t('Advance notice (hours)')}
          <input
            type="number"
            min={0}
            max={168}
            value={rules.leadHours}
            onChange={(e) => update('leadHours', Number(e.target.value))}
            required
          />
        </label>
        <label>
          {t('Booking horizon (days)')}
          <input
            type="number"
            min={1}
            max={365}
            value={rules.horizonDays}
            onChange={(e) => update('horizonDays', Number(e.target.value))}
            required
          />
        </label>
      </div>
      <fieldset className="admin-fieldset">
        <legend>{t('Working days')}</legend>
        <div className="weekday-options">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <label className="checkbox" key={day}>
              <input
                type="checkbox"
                checked={rules.weekdays.includes(day)}
                onChange={(e) =>
                  update(
                    'weekdays',
                    e.target.checked
                      ? [...rules.weekdays, day]
                      : rules.weekdays.filter((d) => d !== day),
                  )
                }
              />
              {new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                timeZone: 'UTC',
              }).format(new Date(Date.UTC(2026, 0, 4 + day)))}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        {(['closedDates', 'openDates'] as const).map((key) => (
          <fieldset className="admin-fieldset" key={key}>
            <legend>
              {t(
                key === 'closedDates'
                  ? 'Holidays & vacation'
                  : 'Additional working dates',
              )}
            </legend>
            <p>
              {t(
                'Add dates individually, including public holidays each year.',
              )}
            </p>
            <label>
              {t('Date')}
              <input
                type="date"
                value={key === 'closedDates' ? closed : open}
                onChange={(e) =>
                  key === 'closedDates'
                    ? setClosed(e.target.value)
                    : setOpen(e.target.value)
                }
              />
            </label>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                const date = key === 'closedDates' ? closed : open;
                if (date && !rules[key].includes(date))
                  update(key, [...rules[key], date].sort());
                key === 'closedDates' ? setClosed('') : setOpen('');
              }}
            >
              {t('Add date')}
            </button>
            <ul className="date-list">
              {rules[key].map((date) => (
                <li key={date}>
                  {date}
                  <button
                    type="button"
                    aria-label={`${t('Remove')} ${date}`}
                    onClick={() =>
                      update(
                        key,
                        rules[key].filter((d) => d !== date),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
      <button className="button" disabled={pending}>
        {t('Save changes')}
      </button>
    </form>
  );
}
export function ContactsEditor({
  value,
  pending,
  onSave,
}: SaveProps & { value: typeof defaultContacts }) {
  const { t } = useAdminLanguage();
  return (
    <form
      className="admin-card"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <h2>{t('Contact & company details')}</h2>
      <p>
        {t(
          'Use verified company information. Empty fields remain placeholders.',
        )}
      </p>
      <div className="form-grid">
        {Object.entries(value).map(([key, v]) => (
          <label key={key}>
            {t(
              (
                {
                  phone: 'Phone',
                  email: 'Email',
                  address: 'Address',
                  company: 'Company',
                  registration: 'Registration number',
                  vat: 'VAT number & status',
                } as Record<string, string>
              )[key],
            )}
            <input
              name={key}
              defaultValue={v}
              type={
                key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'
              }
              maxLength={key === 'address' ? 500 : 200}
            />
          </label>
        ))}
      </div>
      <button className="button" disabled={pending}>
        {t('Save changes')}
      </button>
    </form>
  );
}
export function ContentEditor({
  value,
  pending,
  onSave,
}: SaveProps & { value: Copy }) {
  const { t } = useAdminLanguage();
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="admin-card"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(draft);
      }}
    >
      <h2>{t('Website copy')}</h2>
      <p>
        {t(
          'Edit the visible text below. Changes are saved for the selected language.',
        )}
      </p>
      {Object.entries(draft).map(([key, val]) => (
        <details className="content-field" key={key}>
          <summary>
            <strong>
              {Array.isArray(val)
                ? String(val[0]).slice(0, 90)
                : val.slice(0, 90)}
            </strong>
          </summary>
          {typeof val === 'string' ? (
            <label>
              {t('Text')}
              <textarea
                rows={val.length > 500 ? 8 : 3}
                value={val}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [key]: e.target.value }))
                }
              />
            </label>
          ) : (
            val.map((entry, index) =>
              typeof entry === 'string' ? (
                <label key={index}>
                  {index + 1}
                  <textarea
                    value={entry}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [key]: (d[key as keyof Copy] as string[]).map((v, i) =>
                          i === index ? e.target.value : v,
                        ),
                      }))
                    }
                  />
                </label>
              ) : (
                <div className="form-grid" key={index}>
                  {entry.map((part, partIndex) => (
                    <label key={partIndex}>
                      {t(partIndex === 0 ? 'Question' : 'Answer')}
                      <textarea
                        value={part}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [key]: (d[key as keyof Copy] as string[][]).map(
                              (v, i) =>
                                i === index
                                  ? v.map((p, j) =>
                                      j === partIndex ? e.target.value : p,
                                    )
                                  : v,
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              ),
            )
          )}
        </details>
      ))}
      <button className="button" disabled={pending}>
        {t('Save changes')}
      </button>
    </form>
  );
}
