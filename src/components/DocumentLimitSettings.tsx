'use client';

import { useState, type FormEvent } from 'react';
import {
  documentLimitRanges,
  type DocumentLimits,
} from '@/lib/document-ai-options';
import { useAdminLanguage } from './AdminLanguage';
import { documentAiCopy } from './document-ai-copy';

export const documentSettingsEndpoint = '/api/workspace/document-ai/settings';

export default function DocumentLimitSettings({
  limits,
  change,
}: {
  limits: DocumentLimits;
  change: (limits: DocumentLimits) => void;
}) {
  const { locale } = useAdminLanguage();
  const t = documentAiCopy[locale];
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | ''>('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch(documentSettingsEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileMiB: Number(data.get('fileMiB')),
          pages: Number(data.get('pages')),
          timeoutSeconds: Number(data.get('timeoutSeconds')),
        }),
      });
      if (!response.ok) throw Error();
      change((await response.json()) as DocumentLimits);
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="admin-card document-settings">
      <summary>{t.processingLimits}</summary>
      <form
        key={Object.values(limits).join(':')}
        className="form-grid"
        onSubmit={save}
      >
        {(Object.keys(documentLimitRanges) as (keyof DocumentLimits)[]).map(
          (key) => (
            <label key={key}>
              {t[key]}
              <input
                name={key}
                type="number"
                {...documentLimitRanges[key]}
                defaultValue={limits[key]}
                required
                disabled={saving}
              />
            </label>
          ),
        )}
        <div>
          <button className="button small" disabled={saving}>
            {t.saveLimits}
          </button>
        </div>
      </form>
      {status && (
        <p role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error' ? t.limitsError : t.limitsSaved}
        </p>
      )}
    </details>
  );
}
