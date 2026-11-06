'use client';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';
export default function Enrollment({ token }: { token: string }) {
  const [locale, setLocale] = useState('lv'),
    [secret, setSecret] = useState(''),
    [message, setMessage] = useState(''),
    [done, setDone] = useState(false);
  const c = (
    {
      lv: [
        'Droša konta aktivizēšana',
        'Pievienojiet šo noslēpumu savam autentifikatoram. Neizpaudiet to.',
        'Parole (vismaz 14 rakstzīmes)',
        'Autentifikatora kods',
        'Aktivizēt',
        'Konts aktivizēts. Pieslēdzieties ar nākamo autentifikatora kodu.',
        'Darbība neizdevās. Pārbaudiet saiti un kodu.',
        'Sākt aktivizēšanu',
      ],
      en: [
        'Secure account enrollment',
        'Add this secret to your authenticator. Keep it private.',
        'Password (at least 14 characters)',
        'Authenticator code',
        'Activate',
        'Account activated. Sign in using the next authenticator code.',
        'Request failed. Check the invitation and code.',
        'Begin enrollment',
      ],
      ru: [
        'Безопасная активация аккаунта',
        'Добавьте этот секрет в аутентификатор. Не сообщайте его другим.',
        'Пароль (не менее 14 символов)',
        'Код аутентификатора',
        'Активировать',
        'Аккаунт активирован. Войдите со следующим кодом аутентификатора.',
        'Не удалось выполнить запрос. Проверьте ссылку и код.',
        'Начать активацию',
      ],
    } as Record<string, string[]>
  )[locale];
  return (
    <main className="login-page">
      <div className="admin-card">
        <div className="admin-toolbar">
          <select
            aria-label="LV EN RU"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            {['lv', 'en', 'ru'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <ThemeToggle locale={locale} />
        </div>
        <h1>{c[0]}</h1>
        {!secret && !done && (
          <button
            className="button"
            onClick={async () => {
              try {
                const r = await fetch(`/api/enroll?token=${token}`);
                if (!r.ok) throw Error();
                setSecret((await r.json()).secret);
              } catch {
                setMessage(c[6]);
              }
            }}
          >
            {c[7]}
          </button>
        )}
        {secret && !done && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch('/api/enroll', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    token,
                    password: f.get('password'),
                    code: f.get('code'),
                  }),
                });
                if (!r.ok) throw Error();
                setSecret('');
                setDone(true);
                setMessage(c[5]);
              } catch {
                setMessage(c[6]);
              }
            }}
          >
            <p>{c[1]}</p>
            <code className="enrollment-secret">{secret}</code>
            <label>
              {c[2]}
              <input
                type="password"
                name="password"
                minLength={14}
                maxLength={200}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              {c[3]}
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
              />
            </label>
            <button className="button">{c[4]}</button>
          </form>
        )}
        <p role="status">{message}</p>
        <a href="/admin">TaxSolutions →</a>
      </div>
    </main>
  );
}
