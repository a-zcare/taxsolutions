'use client';
import { useAdminLanguage } from './AdminLanguage';
import { useState } from 'react';
export default function Login() {
  const { t } = useAdminLanguage();
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <main className="login-page">
      <form
        className="admin-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch('/api/admin/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: f.get('email'),
                password: f.get('password'),
              }),
            });
            if (r.ok) window.location.reload();
            else
              setError(
                r.status === 429
                  ? t('Too many attempts. Try again in 15 minutes.')
                  : t('Sign-in failed. Check credentials.'),
              );
          } catch {
            setError(t('Unable to connect.'));
          } finally {
            setPending(false);
          }
        }}
      >
        <a href="/lv" className="logo">
          TaxSolutions
        </a>
        <h1>{t('Administration')}</h1>
        <p>
          {t(
            'Authorized personnel only \u00b7 LV / EN / RU content management',
          )}
        </p>
        <label>
          {t('Email')}
          <input type="email" name="email" required autoComplete="username" />
        </label>
        <label>
          {t('Password')}
          <input
            type="password"
            name="password"
            required
            maxLength={200}
            autoComplete="current-password"
          />
        </label>
        <button className="button" disabled={pending}>
          {pending ? t('Signing in\u2026') : t('Sign in →')}
        </button>
        <p role="alert" className="error">
          {error}
        </p>
      </form>
    </main>
  );
}
