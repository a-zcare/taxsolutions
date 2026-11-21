'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  bytesPerMiB,
  defaultDocumentLimits,
  documentLimitRanges,
  type DocumentLimits,
  type DocumentLanguage,
  type DocumentPage,
} from '@/lib/document-ai-options';
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
import { formatInTimeZone } from 'date-fns-tz';
import DocumentArchiveQueue, {
  type ArchiveSelection,
} from './DocumentArchiveQueue';
import { archiveCopy } from './document-archive-copy';
import {
  archiveEndpoint,
  archiveHeader,
  archiveUploadHeader,
  type ArchiveDetail,
  type ArchiveRow,
} from '@/lib/document-archive-types';
import DocumentFieldSettings from './DocumentFieldSettings';
import DocumentLimitSettings, {
  documentSettingsEndpoint,
} from './DocumentLimitSettings';
import { documentAiCopy } from './document-ai-copy';
import DocumentTemplateSettings from './DocumentTemplateSettings';
import DocumentTemplateTraining from './DocumentTemplateTraining';
import { templateCopy } from './document-template-copy';
import {
  documentTemplateHeader,
  type DocumentRegion,
  type DocumentTemplateInput,
  type TemplateValue,
} from '@/lib/document-ai-regions';

type DocumentEntry = {
  id: string;
  file: File;
  status: 'queued' | 'reading' | 'ready' | 'error';
  type: DocumentType;
  pages: DocumentPage[];
  language: DocumentLanguage;
  templateValues: Record<string, TemplateValue>;
  templateReview: string[];
  fields?: string[];
  edits: Record<string, string>;
  suggestions: Record<string, string>;
  error?: string;
  reviewEnabled?: boolean;
  reviewError?: boolean;
  archive?: ArchiveRow;
  possibleDuplicate?: boolean;
};
const endpoint = '/api/workspace/document-ai';
const maxFiles = 20;
const rawHeaders = { 'Content-Type': 'application/octet-stream' };

async function documentRequest(
  file: File,
  query: URLSearchParams,
  signal: AbortSignal,
  extraHeaders?: Record<string, string>,
) {
  const response = await fetch(`${endpoint}?${query}`, {
    method: 'POST',
    headers: { ...rawHeaders, ...extraHeaders },
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
  region,
  onRegion,
}: {
  entry: DocumentEntry;
  number: number;
  region?: DocumentRegion | null;
  onRegion?: (region: DocumentRegion) => void;
}) {
  const { locale } = useAdminLanguage();
  const t = documentAiCopy[locale];
  const [image, setImage] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<DocumentRegion | null>(null);
  const highlighted = draft ?? region;
  function point(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }
  function rectangle(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

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
          <div
            className={
              onRegion
                ? 'document-image document-image-marking'
                : 'document-image'
            }
            style={{ width: zoom + '%' }}
            onPointerDown={
              onRegion
                ? (event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragStart.current = point(event);
                    setDraft(rectangle(dragStart.current, dragStart.current));
                  }
                : undefined
            }
            onPointerMove={
              onRegion
                ? (event) => {
                    if (dragStart.current)
                      setDraft(rectangle(dragStart.current, point(event)));
                  }
                : undefined
            }
            onPointerUp={
              onRegion
                ? (event) => {
                    if (!dragStart.current) return;
                    const selected = rectangle(dragStart.current, point(event));
                    dragStart.current = null;
                    setDraft(null);
                    if (selected.width >= 0.003 && selected.height >= 0.003)
                      onRegion(selected);
                  }
                : undefined
            }
            onPointerCancel={() => {
              dragStart.current = null;
              setDraft(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Preview uses a private browser blob. */}
            <img
              src={image}
              alt={`${entry.file.name} · ${t.page} ${number}`}
              draggable={false}
              onError={() => setError(true)}
            />
            {highlighted && (
              <span
                className="document-region-selection"
                aria-hidden="true"
                style={{
                  left: highlighted.x * 100 + '%',
                  top: highlighted.y * 100 + '%',
                  width: highlighted.width * 100 + '%',
                  height: highlighted.height * 100 + '%',
                }}
              />
            )}
          </div>
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

export default function DocumentAi({
  staffId,
  visible,
  canManage,
}: {
  staffId: string;
  visible: boolean;
  canManage: boolean;
}) {
  const { locale } = useAdminLanguage();
  const t = documentAiCopy[locale];
  const template = templateCopy[locale];
  const archiveText = archiveCopy[locale];
  const [archiveScope, setArchiveScope] = useState<ArchiveSelection>(() => ({
    clientId: '',
    period: formatInTimeZone(new Date(), 'Europe/Riga', 'yyyy-MM'),
  }));
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState('');
  const [archiveRows, setArchiveRows] = useState<ArchiveRow[]>([]);
  const [highlight, setHighlight] = useState<{
    id: string;
    page: number;
    region: DocumentRegion;
  } | null>(null);
  const [ruleRevision, setRuleRevision] = useState(0);
  const [mark, setMark] = useState<{
    id: string;
    page: number;
    field: string;
    region: DocumentRegion | null;
  } | null>(null);
  const [ruleMessage, setRuleMessage] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const storageKey = 'taxsolutions-document-fields-' + staffId;
  const [settings, setSettings] = useState(defaultFieldSettings);
  const [limits, setLimits] = useState<DocumentLimits | null>(null);
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
      const archived = localStorage.getItem(storageKey + '-archive');
      if (archived) {
        const scope = JSON.parse(archived) as Partial<ArchiveSelection>;
        if (
          typeof scope.clientId === 'string' &&
          typeof scope.period === 'string' &&
          /^[a-f0-9-]{36}$/i.test(scope.clientId) &&
          /^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(scope.period)
        )
          setArchiveScope({ clientId: scope.clientId, period: scope.period });
      }
    } catch {
      setSettings(defaultFieldSettings);
    }
    return () => active.current?.abort();
  }, [storageKey]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void fetch(documentSettingsEndpoint, { signal: controller.signal })
      .then(async (response) => {
        if (response.ok && !controller.signal.aborted)
          setLimits((await response.json()) as DocumentLimits);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [visible]);

  const uploadLimits = limits ?? defaultDocumentLimits;
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
  const training =
    mark?.id === selected?.id && mark?.page === page ? mark : null;

  async function saveRule(
    entry: DocumentEntry,
    field: string,
    matchText: string,
    anchor: string,
    region: DocumentRegion,
  ) {
    const rule: DocumentTemplateInput = {
      type: entry.type,
      matchText,
      field,
      label: fieldLabel(field, settings, locale),
      page,
      region,
      anchor,
    };
    const header = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(rule))),
    );
    const response = await documentRequest(
      entry.file,
      new URLSearchParams({ action: 'teach', language: entry.language }),
      AbortSignal.timeout(360000),
      { [documentTemplateHeader]: header },
    );
    const { value } = (await response.json()) as { value: string };
    setRuleMessage({ id: entry.id, value });
    setRuleRevision((revision) => revision + 1);
    setMark((current) =>
      current?.id === entry.id && current.field === field ? null : current,
    );
  }

  function selectEntry(id: string) {
    setSelectedId(id);
    setPage(1);
  }

  async function openArchive(row: ArchiveRow, reload = false) {
    const existing = entries.find((entry) => entry.archive?.id === row.id);
    if (existing && !reload) {
      selectEntry(existing.id);
      return;
    }
    if (!existing && entries.length >= maxFiles) {
      setError('LIST_FULL');
      return;
    }
    setArchiveBusy(true);
    setArchiveMessage('');
    try {
      const url = `${archiveEndpoint}/${row.id}`;
      const detailResponse = await fetch(url);
      if (!detailResponse.ok) throw Error();
      const detail = (await detailResponse.json()) as ArchiveDetail;
      // When already open, reuse the authenticated original in memory.
      const file =
        existing?.file ??
        (await (async () => {
          const response = await fetch(url + '?file=1');
          if (!response.ok) throw Error();
          const blob = await response.blob();
          return new File([blob], detail.name, { type: blob.type });
        })());
      const { values: savedValues, ...data } = detail.data;
      const item: DocumentEntry = {
        ...data,
        file,
        id: existing?.id ?? row.id,
        archive: detail,
        status: 'ready',
        edits:
          detail.status === 'CONFIRMED'
            ? Object.fromEntries(
                Object.entries(savedValues).map(([key, { value }]) => [
                  key,
                  value,
                ]),
              )
            : data.edits,
        suggestions: {},
        reviewEnabled: detail.reviewEnabled,
        possibleDuplicate: detail.possibleDuplicate,
      };
      if (existing) update(existing.id, () => item);
      else setEntries((all) => [...all, item]);
      selectEntry(item.id);
    } catch {
      setArchiveMessage(archiveText.failed);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function saveReview(entry: DocumentEntry, confirm: boolean) {
    if (!entry.archive || archiveBusy) return;
    setArchiveMessage('');
    setArchiveBusy(true);
    try {
      const snapshot = Object.fromEntries(
        keys.map((key) => [
          key,
          {
            label: fieldLabel(key, settings, locale),
            value: (entry.edits[key] ?? values[key].value).slice(0, 180),
          },
        ]),
      );
      const response = await fetch(`${archiveEndpoint}/${entry.archive.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: entry.archive.revision,
          confirm,
          type: entry.type,
          fields: keys,
          edits: entry.edits,
          values: snapshot,
        }),
      });
      if (response.status === 409) {
        setArchiveMessage(archiveText.conflict);
        return;
      }
      if (!response.ok) throw Error();
      const row = (await response.json()) as ArchiveRow;
      update(entry.id, (item) => ({
        ...item,
        archive: row,
        ...(confirm
          ? {
              fields: keys,
              edits: Object.fromEntries(
                Object.entries(snapshot).map(([key, { value }]) => [
                  key,
                  value,
                ]),
              ),
            }
          : {}),
      }));
      setArchiveRevision((revision) => revision + 1);
      if (!confirm) {
        setArchiveMessage(archiveText.saved);
        return;
      }
      const position = archiveRows.findIndex(
        (candidate) => candidate.id === row.id,
      );
      const ordered = [
        ...archiveRows.slice(position + 1),
        ...archiveRows.slice(0, position + 1),
      ];
      const next = ordered.find(
        (candidate) =>
          candidate.id !== row.id &&
          candidate.status === 'PENDING' &&
          candidate.clientId === row.clientId &&
          candidate.period === row.period,
      );
      const localNext = entries.find(
        (candidate) =>
          candidate.id !== entry.id &&
          candidate.archive?.status === 'PENDING' &&
          candidate.archive.clientId === row.clientId &&
          candidate.archive.period === row.period,
      );
      if (next) await openArchive(next);
      else if (localNext) selectEntry(localNext.id);
      else {
        const params = new URLSearchParams({
          clientId: row.clientId,
          period: row.period,
          status: 'PENDING',
        });
        const response = await fetch(`${archiveEndpoint}?${params}`).catch(
          () => null,
        );
        if (response?.ok) {
          const result = (await response.json()) as { rows: ArchiveRow[] };
          if (result.rows[0]) await openArchive(result.rows[0]);
        }
      }
      setArchiveMessage(archiveText.accepted);
    } catch {
      setArchiveMessage(archiveText.failed);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function split(
    entry: DocumentEntry,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (active.current || archiveBusy) return;
    if (entries.length >= maxFiles) {
      setError('LIST_FULL');
      return;
    }
    const fields = new FormData(event.currentTarget);
    const start = Number(fields.get('start')),
      end = Number(fields.get('end'));
    setArchiveBusy(true);
    setArchiveMessage('');
    try {
      const response = await documentRequest(
        entry.file,
        new URLSearchParams({
          action: 'split',
          start: String(start),
          end: String(end),
        }),
        AbortSignal.timeout(360000),
      );
      const pdf = new File(
        [await response.blob()],
        entry.file.name.replace(/\.pdf$/i, '') + `-${start}-${end}.pdf`,
        { type: 'application/pdf' },
      );
      await processFiles([pdf], entry.language, entry.archive);
      setArchiveMessage(archiveText.splitDone);
    } catch {
      setArchiveMessage(archiveText.failed);
    } finally {
      setArchiveBusy(false);
    }
  }

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
        !entry.suggestions[key] &&
        !entry.templateValues[key],
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
            { 'X-Document-Fields': fields },
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
    if (
      files.some(
        (file) => file.size > documentLimitRanges.fileMiB.max * bytesPerMiB,
      )
    )
      return setError('TOO_LARGE');
    if (entries.length + files.length > maxFiles) return setError('LIST_FULL');

    if (archiveScope.clientId && !archiveScope.period) {
      setArchiveMessage(archiveText.failed);
      return;
    }
    const language = String(fields.get('language')) as DocumentLanguage;
    form.reset();
    await processFiles(
      files,
      language,
      archiveScope.clientId ? archiveScope : undefined,
    );
  }

  async function processFiles(
    files: File[],
    language: DocumentLanguage,
    selection?: ArchiveSelection,
  ) {
    const additions: DocumentEntry[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      type: 'other',
      pages: [],
      language,
      templateValues: {},
      templateReview: [],
      edits: {},
      suggestions: {},
    }));
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setEntries((previous) => [...previous, ...additions]);
    setSelectedId(additions[0].id);
    setPage(1);
    try {
      for (const entry of additions) {
        if (controller.signal.aborted) break;
        update(entry.id, (item) => ({ ...item, status: 'reading' }));
        try {
          const result = await documentRequest(
            entry.file,
            new URLSearchParams({ language }),
            controller.signal,
            selection
              ? {
                  [archiveUploadHeader]: archiveHeader({
                    clientId: selection.clientId,
                    period: selection.period,
                    name: entry.file.name,
                  }),
                }
              : undefined,
          );
          const {
            pages,
            reviewEnabled,
            templateValues,
            templateReview,
            archive,
          } = (await result.json()) as {
            pages: DocumentPage[];
            reviewEnabled: boolean;
            templateValues: Record<string, TemplateValue>;
            templateReview: string[];
            archive?: {
              row: ArchiveRow;
              exactDuplicate: boolean;
              possibleDuplicate: boolean;
            };
          };
          if (archive?.exactDuplicate) {
            update(entry.id, (item) => ({
              ...item,
              archive: archive.row,
              status: 'error',
              error: 'EXACT_DUPLICATE',
            }));
            setArchiveRevision((revision) => revision + 1);
            continue;
          }
          const type = detectDocumentType(pages);
          const ready = {
            ...entry,
            pages,
            type,
            reviewEnabled,
            templateValues,
            templateReview,
            archive: archive?.row,
            possibleDuplicate: archive?.possibleDuplicate,
            status: 'ready',
          } as const;
          update(entry.id, (item) => ({
            ...item,
            pages,
            type,
            reviewEnabled,
            templateValues,
            templateReview,
            archive: archive?.row,
            possibleDuplicate: archive?.possibleDuplicate,
            status: 'ready',
          }));
          if (archive) setArchiveRevision((revision) => revision + 1);
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
    EXACT_DUPLICATE: archiveText.duplicate,
  };

  return (
    <div className="document-workspace">
      <DocumentArchiveQueue
        visible={visible}
        scope={archiveScope}
        setScope={(scope) => {
          setArchiveScope(scope);
          try {
            localStorage.setItem(
              storageKey + '-archive',
              JSON.stringify(scope),
            );
          } catch {
            // The filters still work in this session.
          }
        }}
        revision={archiveRevision}
        selectedId={selected?.archive?.id}
        onOpen={(row) => void openArchive(row)}
        onRows={setArchiveRows}
        disabled={archiveBusy || busy || !!reviewing}
      />
      {archiveMessage && <p role="status">{archiveMessage}</p>}
      <section className="admin-card">
        <p>
          {archiveScope.clientId ? archiveText.archived : archiveText.temporary}
        </p>
        <form className="form-grid" onSubmit={submit}>
          <label>
            {t.file(uploadLimits.fileMiB, uploadLimits.pages)}
            <input
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              required
              disabled={archiveBusy || busy || !!reviewing}
            />
          </label>
          <label>
            {t.language}
            <select
              name="language"
              defaultValue="auto"
              disabled={archiveBusy || busy || !!reviewing}
            >
              <option value="auto">{t.mixed}</option>
              <option value="lv">Latviešu</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <div>
            <button
              className="button small"
              disabled={archiveBusy || busy || !!reviewing}
            >
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
      {canManage && limits && (
        <DocumentLimitSettings limits={limits} change={setLimits} />
      )}
      <DocumentFieldSettings settings={settings} change={changeSettings} />
      {canManage && (
        <DocumentTemplateSettings visible={visible} revision={ruleRevision} />
      )}
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
                  ? entry.archive?.status === 'CONFIRMED'
                    ? archiveText.confirmed
                    : documentTypes[entry.type][locale]
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
                disabled={archiveBusy || busy || !!reviewing}
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
            {selected.archive && selected.error === 'EXACT_DUPLICATE' && (
              <button
                type="button"
                className="button secondary small"
                disabled={archiveBusy}
                onClick={() => void openArchive(selected.archive!, true)}
              >
                {archiveText.reload}
              </button>
            )}
            {selected.possibleDuplicate && (
              <p role="status">{archiveText.possible}</p>
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
                    region={
                      training?.region ??
                      (highlight?.id === selected.id && highlight.page === page
                        ? highlight.region
                        : undefined)
                    }
                    onRegion={
                      training
                        ? (region) => setMark({ ...training, region })
                        : undefined
                    }
                  />
                  {selected.pages.length > 1 && (
                    <form
                      className="form-grid"
                      key={selected.id + ':split:' + page}
                      onSubmit={(event) => void split(selected, event)}
                    >
                      <label>
                        {archiveText.first}
                        <input
                          type="number"
                          min={1}
                          max={selected.pages.length}
                          defaultValue={page}
                          name="start"
                          required
                        />
                      </label>
                      <label>
                        {archiveText.last}
                        <input
                          type="number"
                          min={1}
                          max={selected.pages.length}
                          defaultValue={page}
                          name="end"
                          required
                        />
                      </label>
                      <button
                        className="button secondary small"
                        disabled={archiveBusy || busy || !!reviewing}
                      >
                        {archiveText.split}
                      </button>
                    </form>
                  )}
                  {training && (
                    <DocumentTemplateTraining
                      key={
                        training.id + ':' + training.page + ':' + training.field
                      }
                      label={fieldLabel(training.field, settings, locale)}
                      supplier={
                        selected.edits.supplier ??
                        captureFields(
                          selected.pages,
                          ['supplier', 'registration'],
                          settings,
                        ).supplier.value
                      }
                      region={training.region}
                      onRegion={(region) => setMark({ ...training, region })}
                      onSave={(supplier, anchor, region) =>
                        saveRule(
                          selected,
                          training.field,
                          supplier,
                          anchor,
                          region,
                        )
                      }
                      onCancel={() => setMark(null)}
                    />
                  )}
                  {ruleMessage?.id === selected.id && (
                    <p role="status">
                      {template.saved} {ruleMessage.value}
                    </p>
                  )}
                </div>
                <div className="document-fields">
                  <label>
                    {t.kind}
                    <select
                      value={selected.type}
                      disabled={
                        selected.archive?.status === 'CONFIRMED' || archiveBusy
                      }
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
                        disabled={selected.archive?.status === 'CONFIRMED'}
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
                            disabled={selected.archive?.status === 'CONFIRMED'}
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
                    const templateValue = selected.templateValues[key];
                    const suggestion =
                      templateValue?.value ?? selected.suggestions[key];
                    const needsReview =
                      value.uncertain || selected.templateReview.includes(key);
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
                            readOnly={
                              selected.archive?.status === 'CONFIRMED' ||
                              archiveBusy
                            }
                            maxLength={180}
                            placeholder={t.missing}
                            onChange={(event) => edit(event.target.value)}
                          />
                        </label>
                        {canManage && (
                          <button
                            type="button"
                            className="button secondary small"
                            aria-label={`${template.mark} · ${fieldLabel(key, settings, locale)}`}
                            onClick={() => {
                              setRuleMessage(null);
                              setMark({
                                id: selected.id,
                                page,
                                field: key,
                                region: null,
                              });
                              document
                                .querySelector('.document-preview')
                                ?.scrollIntoView({ block: 'nearest' });
                            }}
                          >
                            {template.mark}
                          </button>
                        )}
                        {edited && <small>{t.edited}</small>}
                        {!edited && needsReview && (
                          <small className="document-uncertain">
                            {t.uncertain}
                          </small>
                        )}
                        {!edited &&
                          suggestion &&
                          selected.archive?.status !== 'CONFIRMED' && (
                            <div className="document-suggestion">
                              <span>
                                {templateValue ? template.from : t.suggestion} ·{' '}
                                {suggestion}
                              </span>
                              {templateValue && (
                                <button
                                  type="button"
                                  className="button secondary small"
                                  onClick={() => {
                                    setMark(null);
                                    setPage(templateValue.page);
                                    setHighlight({
                                      id: selected.id,
                                      page: templateValue.page,
                                      region: templateValue.region,
                                    });
                                  }}
                                >
                                  {archiveText.source}
                                </button>
                              )}
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
                  {selected.archive?.status !== 'CONFIRMED' &&
                    selected.reviewEnabled &&
                    keys.some(
                      (key) =>
                        (values[key].page === page || !values[key].value) &&
                        values[key].uncertain &&
                        !Object.hasOwn(selected.edits, key) &&
                        !selected.suggestions[key] &&
                        !selected.templateValues[key],
                    ) && (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={archiveBusy || busy || !!reviewing}
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
                  {selected.archive?.status === 'PENDING' && (
                    <div className="document-heading">
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={archiveBusy || busy || !!reviewing}
                        onClick={() => void saveReview(selected, false)}
                      >
                        {archiveText.draft}
                      </button>
                      <button
                        type="button"
                        className="button small"
                        disabled={archiveBusy || busy || !!reviewing}
                        onClick={() => void saveReview(selected, true)}
                      >
                        {archiveText.approve}
                      </button>
                      {archiveMessage === archiveText.conflict && (
                        <button
                          type="button"
                          className="button secondary small"
                          disabled={archiveBusy}
                          onClick={() =>
                            void openArchive(selected.archive!, true)
                          }
                        >
                          {archiveText.reload}
                        </button>
                      )}
                    </div>
                  )}
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
