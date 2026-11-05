'use client';
import { useState } from 'react';
import type { Copy, Locale } from '@/lib/i18n';
export default function ContactForm({
  c,
  locale,
  configured,
}: {
  c: Copy;
  locale: Locale;
  configured: boolean;
}) {
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <form
      className="contact-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const form = e.currentTarget;
        const f = new FormData(form);
        try {
          const r = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: f.get('name'),
              email: f.get('email'),
              comment: f.get('comment'),
              consent: f.get('consent') === 'on',
              website: f.get('website'),
              locale,
            }),
          });
          setMessage(
            r.ok
              ? c.contactSuccess
              : r.status === 429
                ? c.rate
                : r.status === 400
                  ? c.invalid
                  : c.error,
          );
          if (r.ok) form.reset();
        } catch {
          setMessage(c.error);
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        {c.name}
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label>
        {c.email}
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
        />
      </label>
      <label>
        {c.comment}
        <textarea
          name="comment"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
        />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="consent" required />
        <span>
          {c.consent} <a href={`/${locale}/privacy`}>{c.privacy}</a>
        </span>
      </label>
      <button className="button" disabled={pending || !configured}>
        {pending ? c.loading : c.contactSend} ↗
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
