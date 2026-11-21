'use client';

import { useEffect, useState } from 'react';
import { documentTypes } from '@/lib/document-ai-fields';
import type { DocumentTemplate } from '@/lib/document-ai-regions';
import { useAdminLanguage } from './AdminLanguage';
import { templateCopy } from './document-template-copy';

const endpoint = '/api/workspace/document-ai/templates';

export default function DocumentTemplateSettings({
  visible,
  revision,
}: {
  visible: boolean;
  revision: number;
}) {
  const { locale } = useAdminLanguage();
  const t = templateCopy[locale];
  const [opened, setOpened] = useState(false);
  const [rows, setRows] = useState<DocumentTemplate[] | null>(null);
  const [error, setError] = useState<'read' | 'remove' | ''>('');
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    if (!visible || !opened) return;
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const rows = (await response.json()) as DocumentTemplate[];
        if (!controller.signal.aborted) {
          setRows(rows);
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('read');
      });
    return () => controller.abort();
  }, [opened, revision, visible]);

  async function remove(id: string) {
    setRemoving(true);
    setError('');
    try {
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw Error();
      setRows((rules) => rules?.filter((rule) => rule.id !== id) ?? null);
    } catch {
      setError('remove');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <details
      className="admin-card document-settings"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>{t.list}</summary>
      {error && (
        <p role="alert">{error === 'read' ? t.readError : t.removeError}</p>
      )}
      {rows && !rows.length && <p>{t.empty}</p>}
      {rows?.map((rule) => (
        <div className="document-heading" key={rule.id}>
          <p>
            {rule.matchText} · {documentTypes[rule.type][locale]} · {rule.label}
          </p>
          <button
            className="button secondary small"
            type="button"
            disabled={removing}
            onClick={() => void remove(rule.id)}
          >
            {t.remove}
          </button>
        </div>
      ))}
    </details>
  );
}
