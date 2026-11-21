'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { maxDocumentBytes, type DocumentPage } from '@/lib/document-ai-options';
import {
  availableFields,
  captureFields,
  defaultFieldSettings,
  detectDocumentType,
  documentTypes,
  fieldLabel,
  readFieldSettings,
  visibleFields,
  type DocumentType,
  type FieldSettings,
} from '@/lib/document-ai-fields';
import { useAdminLanguage } from './AdminLanguage';
import DocumentFieldSettings from './DocumentFieldSettings';
import { documentAiCopy } from './document-ai-copy';

type DocumentEntry = {
  id: string;
  file: File;
  status: 'queued' | 'reading' | 'ready' | 'error';
  type: DocumentType;
  pages: DocumentPage[];
  fields?: string[];
  edits: Record<string, string>;
  suggestions: Record<string, string>;
  error?: string;
  reviewEnabled?: boolean;
  reviewError?: boolean;
};
const endpoint = '/api/workspace/document-ai';
const maxFiles = 20;
const rawHeaders = { 'Content-Type': 'application/octet-stream' };

async function documentRequest(
  file: File,
  query: URLSearchParams,
  signal: AbortSignal,
  fields?: string,
) {
  const response = await fetch(`${endpoint}?${query}`, {
    method: 'POST',
    headers: fields
      ? { ...rawHeaders, 'X-Document-Fields': fields }
      : rawHeaders,
    body: file,
    signal,
  });
  if (response.status === 413) throw Error('TOO_LARGE');
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw Error(result.error ?? 'UNREADABLE');
  }
  return response;
}

function DocumentPreview({
  entry,
  number,
}: {
  entry: DocumentEntry;
  number: number;
}) {
  const { locale } = useAdminLanguage();
  const t = documentAiCopy[locale];
  const [image, setImage] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const controller = new AbortController();
    let url = '';
    async function load() {
      try {
        const file = entry.file;
        const image =
          /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
            ? await (
                await documentRequest(
                  file,
                  new URLSearchParams({
                    action: 'preview',
                    page: String(number),
                  }),
                  controller.signal,
                )
              ).blob()
            : file;
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(image);
        setImage(url);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.file, number, attempt]);

  return (
    <>
      <label className="document-zoom">
        {t.zoom} · {zoom}%
        <input
          type="range"
          min={100}
          max={250}
          step={25}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
      </label>
      <div className="document-preview">
        {image && !error && (
          // eslint-disable-next-line @next/next/no-img-element -- Preview is a private, temporary browser blob.
          <img
            src={image}
            style={{ width: zoom + '%', maxWidth: 'none' }}
            alt={`${entry.file.name} · ${t.page} ${number}`}
            onError={() => setError(true)}
          />
        )}
        {error && (
          <div role="alert">
            <p>{t.previewError}</p>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                setError(false);
                setImage('');
                setAttempt((current) => current + 1);
              }}
            >
              {t.retry}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function DocumentAi({ staffId }: { staffId: string }) {
  const { locale } = useAdminLanguage();
  const t = documentAiCopy[locale];
  const storageKey = 'taxsolutions-document-fields-' + staffId;
  const [settings, setSettings] = useState(defaultFieldSettings);
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      setSettings(readFieldSettings(localStorage.getItem(storageKey)));
    } catch {
      setSettings(defaultFieldSettings);
    }
    return () => active.current?.abort();
  }, [storageKey]);

  const selected = entries.find((item) => item.id === selectedId);
  const selectedType = selected?.type;
  const selectedPages = selected?.pages;
  const selectedFields = selected?.fields;
  const { keys, values } = useMemo(() => {
    const keys =
      selectedFields ??
      (selectedType ? visibleFields(settings, selectedType) : []);
    return {
      keys,
      values: selectedPages ? captureFields(selectedPages, keys, settings) : {},
    };
  }, [selectedFields, selectedType, selectedPages, settings]);
  const currentPage = selected?.pages[page - 1];

  function changeSettings(next: FieldSettings) {
    setSettings(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Settings remain usable for this session when browser storage is blocked.
    }
  }

  function update(id: string, change: (entry: DocumentEntry) => DocumentEntry) {
    setEntries((list) =>
      list.map((item) => (item.id === id ? change(item) : item)),
    );
  }

  async function review(
    entry: DocumentEntry,
    signal: AbortSignal,
    preferredPage?: number,
  ) {
    const fields = captureFields(
      entry.pages,
      entry.fields ?? visibleFields(settings, entry.type),
      settings,
    );
    const candidates = Object.entries(fields).filter(
      ([key, value]) =>
        value.uncertain &&
        !Object.hasOwn(entry.edits, key) &&
        !entry.suggestions[key],
    );
    const targets = preferredPage
      ? [preferredPage]
      : [...new Set(candidates.map(([, value]) => value.page))];
    if (!candidates.length) return;
    setReviewing(entry.id);
    try {
      for (const target of targets) {
        const onPage = candidates.filter(
          ([, value]) =>
            value.page === target ||
            (preferredPage !== undefined && !value.value),
        );
        for (let offset = 0; offset < onPage.length; offset += 6) {
          const chosen = onPage.slice(offset, offset + 6);
          const hints = chosen.map(([key, value]) => ({
            label: fieldLabel(key, settings, locale),
            value: value.value.slice(0, 60),
          }));
          const fields = btoa(
            String.fromCharCode(
              ...new TextEncoder().encode(JSON.stringify(hints)),
            ),
          );
          const response = await documentRequest(
            entry.file,
            new URLSearchParams({ action: 'review', page: String(target) }),
            signal,
            fields,
          );
          const { values } = (await response.json()) as {
            values: (string | null)[];
          };
          const suggestions = Object.fromEntries(
            chosen.flatMap(([key], index) =>
              values[index] ? [[key, values[index]]] : [],
            ),
          );
          update(entry.id, (item) => ({
            ...item,
            suggestions: { ...item.suggestions, ...suggestions },
            reviewError: false,
          }));
        }
      }
    } catch {
      if (!signal.aborted)
        update(entry.id, (item) => ({ ...item, reviewError: true }));
    } finally {
      if (!signal.aborted) setReviewing('');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    setError('');
    const form = event.currentTarget;
    const fields = new FormData(form);
    const files = fields
      .getAll('document')
      .filter((file): file is File => file instanceof File && !!file.size);
    if (!files.length) return setError('UNSUPPORTED_FILE');
    if (files.some((file) => file.size > maxDocumentBytes))
      return setError('TOO_LARGE');
    if (entries.length + files.length > maxFiles) return setError('LIST_FULL');

    const additions: DocumentEntry[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      type: 'other',
      pages: [],
      edits: {},
      suggestions: {},
    }));
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setEntries((previous) => [...previous, ...additions]);
    setSelectedId(additions[0].id);
    setPage(1);
    form.reset();
    const language = String(fields.get('language'));
    try {
      for (const entry of additions) {
        if (controller.signal.aborted) break;
        update(entry.id, (item) => ({ ...item, status: 'reading' }));
        try {
          const result = await documentRequest(
            entry.file,
            new URLSearchParams({ language }),
            controller.signal,
          );
          const { pages, reviewEnabled } = (await result.json()) as {
            pages: DocumentPage[];
            reviewEnabled: boolean;
          };
          const type = detectDocumentType(pages);
          const ready = {
            ...entry,
            pages,
            type,
            reviewEnabled,
            status: 'ready',
          } as const;
          update(entry.id, (item) => ({
            ...item,
            pages,
            type,
            reviewEnabled,
            status: 'ready',
          }));
          if (reviewEnabled) await review(ready, controller.signal);
        } catch (error) {
          if (!controller.signal.aborted)
            update(entry.id, (item) => ({
              ...item,
              status: 'error',
              error: error instanceof Error ? error.message : 'UNREADABLE',
            }));
        }
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function recheck(entry: DocumentEntry) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    try {
      await review(entry, controller.signal, page);
    } finally {
      active.current = null;
    }
  }

  function download(entry: DocumentEntry) {
    const fields = keys.map(
      (key) =>
        `${fieldLabel(key, settings, locale)}: ${entry.edits[key] ?? values[key].value}`,
    );
    const text = [
      ...fields,
      '',
      ...entry.pages.map((page) => `${t.page} ${page.number}\n${page.text}`),
    ].join('\n\n');
    const url = URL.createObjectURL(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'taxsolutions-ocr.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const errors: Record<string, string> = {
    TOO_LARGE: t.large,
    TOO_MANY_PAGES: t.many,
    UNSUPPORTED_FILE: t.unsupported,
    OCR_UNAVAILABLE: t.unavailable,
    TIMEOUT: t.timeout,
    BUSY: t.retry,
    RATE: t.retry,
    LIST_FULL: t.limit,
  };

  return (
    <div className="document-workspace">
      <section className="admin-card">
        <p>{t.intro}</p>
        <form className="form-grid" onSubmit={submit}>
          <label>
            {t.file}
            <input
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              required
              disabled={busy || !!reviewing}
            />
          </label>
          <label>
            {t.language}
            <select
              name="language"
              defaultValue="auto"
              disabled={busy || !!reviewing}
            >
              <option value="auto">{t.mixed}</option>
              <option value="lv">Latviešu</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <div>
            <button className="button small" disabled={busy || !!reviewing}>
              {t.run}
            </button>
          </div>
        </form>
        {error && (
          <p role="alert" className="crm-feedback error">
            {errors[error] ?? t.failed}
          </p>
        )}
      </section>
      <DocumentFieldSettings settings={settings} change={changeSettings} />
      <div className="document-layout">
        <section className="admin-card document-file-list" aria-label={t.files}>
          <h2>{t.files}</h2>
          {entries.length === 0 && <p>{t.emptyList}</p>}
          {entries.map((entry) => (
            <button
              type="button"
              key={entry.id}
              aria-current={entry.id === selectedId ? 'true' : undefined}
              onClick={() => {
                setSelectedId(entry.id);
                setPage(1);
              }}
            >
              <strong>{entry.file.name}</strong>
              <small>
                {entry.status === 'ready'
                  ? documentTypes[entry.type][locale]
                  : entry.status === 'error'
                    ? t.failed
                    : entry.status === 'reading'
                      ? t.busy
                      : t.queued}
              </small>
            </button>
          ))}
        </section>
        {selected && (
          <section
            className="admin-card document-selected"
            aria-label={t.preview}
          >
            <div className="document-heading">
              <h2>{selected.file.name}</h2>
              <button
                type="button"
                className="button secondary small"
                disabled={busy || !!reviewing}
                onClick={() => {
                  const index = entries.findIndex(
                    (item) => item.id === selected.id,
                  );
                  const next = entries.filter(
                    (item) => item.id !== selected.id,
                  );
                  setEntries(next);
                  setSelectedId(
                    next[Math.min(index, next.length - 1)]?.id ?? '',
                  );
                  setPage(1);
                }}
              >
                {t.remove}
              </button>
            </div>
            {selected.status === 'error' && (
              <p role="alert">{errors[selected.error ?? ''] ?? t.failed}</p>
            )}
            {selected.status === 'reading' && <p role="status">{t.busy}</p>}
            {selected.status === 'queued' && <p role="status">{t.queued}</p>}
            {selected.status === 'ready' && currentPage && (
              <div className="document-inspector">
                <div>
                  <div className="document-pages">
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      aria-label={t.previous}
                    >
                      ‹
                    </button>
                    <span>
                      {t.page} {page} / {selected.pages.length}
                    </span>
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={page >= selected.pages.length}
                      onClick={() => setPage(page + 1)}
                      aria-label={t.next}
                    >
                      ›
                    </button>
                  </div>
                  <DocumentPreview
                    key={selected.id + ':' + page}
                    entry={selected}
                    number={page}
                  />
                </div>
                <div className="document-fields">
                  <label>
                    {t.kind}
                    <select
                      value={selected.type}
                      onChange={(event) => {
                        const type = event.target.value as DocumentType;
                        update(selected.id, (item) => ({ ...item, type }));
                      }}
                    >
                      {Object.entries(documentTypes).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <h3>{t.fields}</h3>
                  <details className="document-settings">
                    <summary>{t.fileFields}</summary>
                    {selected.fields && (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() =>
                          update(selected.id, (item) => ({
                            ...item,
                            fields: undefined,
                          }))
                        }
                      >
                        {t.resetFile}
                      </button>
                    )}
                    <div className="document-field-options">
                      {availableFields(settings).map((key) => (
                        <label key={key}>
                          <input
                            type="checkbox"
                            checked={keys.includes(key)}
                            onChange={(event) => {
                              const fields = event.target.checked
                                ? [...keys, key]
                                : keys.filter((item) => item !== key);
                              update(selected.id, (item) => ({
                                ...item,
                                fields,
                              }));
                            }}
                          />
                          {fieldLabel(key, settings, locale)}
                        </label>
                      ))}
                    </div>
                  </details>
                  {keys.map((key) => {
                    const value = values[key];
                    const edited = Object.hasOwn(selected.edits, key);
                    const suggestion = selected.suggestions[key];
                    const edit = (text: string) =>
                      update(selected.id, (item) => ({
                        ...item,
                        edits: { ...item.edits, [key]: text },
                      }));
                    return (
                      <div key={key} className="document-field">
                        <label>
                          {fieldLabel(key, settings, locale)}
                          <input
                            value={selected.edits[key] ?? value.value}
                            maxLength={180}
                            placeholder={t.missing}
                            onChange={(event) => edit(event.target.value)}
                          />
                        </label>
                        {edited && <small>{t.edited}</small>}
                        {!edited && value.uncertain && (
                          <small className="document-uncertain">
                            {t.uncertain}
                          </small>
                        )}
                        {!edited && suggestion && (
                          <div className="document-suggestion">
                            <span>
                              {t.suggestion} · {suggestion}
                            </span>
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => edit(suggestion)}
                            >
                              {t.apply}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selected.reviewEnabled &&
                    keys.some(
                      (key) =>
                        (values[key].page === page || !values[key].value) &&
                        values[key].uncertain &&
                        !Object.hasOwn(selected.edits, key) &&
                        !selected.suggestions[key],
                    ) && (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={busy || !!reviewing}
                        onClick={() => void recheck(selected)}
                      >
                        {t.check}
                      </button>
                    )}
                  {reviewing === selected.id && <p role="status">Ollama…</p>}
                  {selected.reviewError && <p role="status">{t.reviewError}</p>}
                  <label>
                    {t.page} {currentPage.number} ·{' '}
                    {currentPage.source === 'ocr' ? 'OCR' : t.embedded}
                    <textarea
                      readOnly
                      rows={6}
                      value={currentPage.text || t.empty}
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => download(selected)}
                  >
                    {t.download}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
