'use client';
import { useState } from 'react';
import type { Copy } from '@/lib/i18n';
export default function Cancel({ token, c }: { token: string; c: Copy }) {
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <div>
      <button
        className="button"
        disabled={pending || message === c.cancelled}
        onClick={async () => {
          setPending(true);
          try {
            const r = await fetch('/api/bookings/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            });
            setMessage(r.ok ? c.cancelled : c.error);
          } catch {
            setMessage(c.error);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? c.loading : c.cancel}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
