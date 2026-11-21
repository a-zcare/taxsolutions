'use client';

import { useEffect, useState } from 'react';
import { archiveEndpoint, type ArchiveRow } from '@/lib/document-archive-types';
import { useAdminLanguage } from './AdminLanguage';
import { archiveCopy } from './document-archive-copy';

export type ArchiveSelection = { clientId: string; period: string };

export default function DocumentArchiveQueue({
  visible,
  scope,
  setScope,
  revision,
  selectedId,
  onOpen,
  onRows,
  disabled,
}: {
  visible: boolean;
  scope: ArchiveSelection;
  setScope: (scope: ArchiveSelection) => void;
  revision: number;
  selectedId?: string;
  onOpen: (row: ArchiveRow) => void;
  onRows: (rows: ArchiveRow[]) => void;
  disabled: boolean;
}) {
  const { locale } = useAdminLanguage();
  const t = archiveCopy[locale];
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [index, setIndex] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [clientError, setClientError] = useState(false);
  const [queueError, setQueueError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        action: 'clients',
        q: query,
        selected: scope.clientId,
      });
      void fetch(`${archiveEndpoint}?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw Error();
          const options = await response.json();
          if (!controller.signal.aborted) {
            setClients(options);
            setClientError(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setClientError(true);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, query, scope.clientId]);

  useEffect(() => {
    if (!visible || !scope.clientId || !scope.period) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      ...scope,
      status,
      page: String(index),
    });
    void fetch(`${archiveEndpoint}?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result = (await response.json()) as {
          rows: ArchiveRow[];
          next: boolean;
        };
        if (!controller.signal.aborted) {
          setRows(result.rows);
          onRows(result.rows);
          setHasNext(result.next);
          setQueueError(false);
          if (!result.rows.length && index > 0) setIndex(index - 1);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setQueueError(true);
      });
    return () => controller.abort();
  }, [visible, scope, status, index, revision, onRows]);

  function resetPage() {
    setIndex(0);
    setRows([]);
    onRows([]);
    setHasNext(false);
    setQueueError(false);
  }
  const exportParams = new URLSearchParams({ ...scope, action: 'export' });

  return (
    <section className="admin-card document-archive" aria-label={t.queue}>
      <h2>{t.queue}</h2>
      {clientError && <p role="alert">{t.failed}</p>}
      <div className="form-grid">
        <label>
          {t.search}
          <input
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          {t.client}
          <select
            value={scope.clientId}
            disabled={disabled}
            onChange={(event) => {
              resetPage();
              setScope({ ...scope, clientId: event.target.value });
            }}
          >
            <option value="">{t.choose}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.period}
          <input
            type="month"
            value={scope.period}
            disabled={disabled}
            onChange={(event) => {
              resetPage();
              setScope({ ...scope, period: event.target.value });
            }}
          />
        </label>
        <label>
          {t.status}
          <select
            value={status}
            onChange={(event) => {
              resetPage();
              setStatus(event.target.value);
            }}
          >
            <option value="PENDING">{t.pending}</option>
            <option value="CONFIRMED">{t.confirmed}</option>
            <option value="">{t.all}</option>
          </select>
        </label>
      </div>
      {scope.clientId && scope.period && (
        <>
          {queueError ? (
            <p role="alert">{t.failed}</p>
          ) : (
            !rows.length && <p>{t.empty}</p>
          )}
          <div className="document-file-list document-archive-list">
            {rows.map((row) => (
              <button
                type="button"
                key={row.id}
                disabled={disabled}
                aria-current={row.id === selectedId ? 'true' : undefined}
                onClick={() => onOpen(row)}
              >
                <strong>{row.name}</strong>
                <small>
                  {row.status === 'CONFIRMED' ? t.confirmed : t.pending}
                </small>
              </button>
            ))}
          </div>
          <div className="document-pages">
            {index > 0 && (
              <button
                type="button"
                className="button secondary small"
                onClick={() => setIndex(index - 1)}
              >
                {t.previous}
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                className="button secondary small"
                onClick={() => setIndex(index + 1)}
              >
                {t.next}
              </button>
            )}
            <a
              className="button secondary small"
              href={`${archiveEndpoint}?${exportParams}`}
            >
              {t.export}
            </a>
          </div>
        </>
      )}
    </section>
  );
}
