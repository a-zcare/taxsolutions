'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { maxDocumentBytes } from '@/lib/document-ai-options';
import { useAdminLanguage } from './AdminLanguage';

type Page = { number: number; source: 'embedded' | 'ocr'; text: string };

const copy = {
  lv: {
    intro:
      'Atpazīstiet tekstu PDF dokumentos un JPG vai PNG attēlos. Fails un rezultāts netiek saglabāti CRM.',
    file: 'Dokuments (līdz 10 MB, PDF līdz 12 lapām)',
    language: 'Dokumenta valoda',
    mixed: 'Latviešu, angļu un krievu',
    run: 'Atpazīt tekstu',
    busy: 'Notiek teksta atpazīšana…',
    download: 'Lejupielādēt tekstu (.txt)',
    review:
      'Pirms izmantošanas pārbaudiet summas, datumus un reģistrācijas numurus.',
    page: 'Lapa',
    embedded: 'PDF teksta slānis',
    empty: 'Teksts nav atrasts.',
    large: 'Izvēlieties failu līdz 10 MB.',
    many: 'PDF failā drīkst būt līdz 12 lapām.',
    unsupported: 'Izvēlieties PDF, JPG vai PNG failu.',
    failed: 'Dokumentu neizdevās nolasīt.',
    unavailable: 'OCR dzinējs nav pieejams. Sazinieties ar administratoru.',
    retry: 'Mēģiniet vēlreiz pēc brīža.',
    timeout:
      'Atpazīšana pārsniedza laika ierobežojumu. Sadaliet dokumentu mazākās daļās.',
  },
  en: {
    intro:
      'Extract text from PDFs and JPG or PNG images. The CRM does not store the file or result.',
    file: 'Document (up to 10 MB, PDF up to 12 pages)',
    language: 'Document language',
    mixed: 'Latvian, English and Russian',
    run: 'Extract text',
    busy: 'Recognizing text…',
    download: 'Download text (.txt)',
    review:
      'Verify amounts, dates and registration numbers before using the text.',
    page: 'Page',
    embedded: 'PDF text layer',
    empty: 'No text found.',
    large: 'Choose a file up to 10 MB.',
    many: 'Choose a PDF with up to 12 pages.',
    unsupported: 'Choose a PDF, JPG or PNG file.',
    failed: 'Could not read the document.',
    unavailable: 'The OCR engine is unavailable. Contact your administrator.',
    retry: 'Try again in a moment.',
    timeout: 'Recognition timed out. Split the document into smaller parts.',
  },
  ru: {
    intro:
      'Извлекает текст из PDF и изображений JPG или PNG. Файл и результат не сохраняются в CRM.',
    file: 'Документ (до 10 МБ, PDF до 12 страниц)',
    language: 'Язык документа',
    mixed: 'Латышский, английский и русский',
    run: 'Распознать текст',
    busy: 'Распознаём текст…',
    download: 'Скачать текст (.txt)',
    review:
      'Перед использованием сверьте суммы, даты и регистрационные номера.',
    page: 'Страница',
    embedded: 'Текстовый слой PDF',
    empty: 'Текст не найден.',
    large: 'Выберите файл размером до 10 МБ.',
    many: 'Выберите PDF до 12 страниц.',
    unsupported: 'Выберите файл PDF, JPG или PNG.',
    failed: 'Не удалось прочитать документ.',
    unavailable: 'OCR недоступен. Обратитесь к администратору.',
    retry: 'Повторите попытку через минуту.',
    timeout: 'Время распознавания истекло. Разделите документ на части.',
  },
};

export default function DocumentAi() {
  const { locale } = useAdminLanguage();
  const t = copy[locale];
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    setPages([]);
    setError('');
    const fields = new FormData(event.currentTarget);
    const file = fields.get('document');
    if (!(file instanceof File) || !file.size) {
      setError('UNSUPPORTED_FILE');
      return;
    }
    if (file.size > maxDocumentBytes) {
      setError('TOO_LARGE');
      return;
    }
    const language = encodeURIComponent(String(fields.get('language')));
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/workspace/document-ai?language=${language}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
          signal: controller.signal,
        },
      );
      if (response.status === 413) {
        setError('TOO_LARGE');
        return;
      }
      const result = await response.json();
      if (response.ok) setPages(result.pages);
      else setError(result.error);
    } catch {
      if (!controller.signal.aborted) setError('UNREADABLE');
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function download() {
    const text = pages
      .map((page) => `${t.page} ${page.number}\n${page.text}`)
      .join('\n\n');
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
  };

  return (
    <section className="admin-card">
      <p>{t.intro}</p>
      <form className="form-grid" onSubmit={submit}>
        <label>
          {t.file}
          <input
            name="document"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            required
            disabled={busy}
            onChange={() => {
              setPages([]);
              setError('');
            }}
          />
        </label>
        <label>
          {t.language}
          <select name="language" defaultValue="auto" disabled={busy}>
            <option value="auto">{t.mixed}</option>
            <option value="lv">Latviešu</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </label>
        <div>
          <button className="button small" disabled={busy}>
            {t.run}
          </button>
        </div>
      </form>
      {busy && <p role="status">{t.busy}</p>}
      {error && (
        <p role="alert" className="crm-feedback error">
          {errors[error] ?? t.failed}
        </p>
      )}
      {!!pages.length && (
        <>
          {pages.some((page) => page.text) && (
            <>
              <p role="status">{t.review}</p>
              <button
                type="button"
                className="button secondary small"
                onClick={download}
              >
                {t.download}
              </button>
            </>
          )}
          {pages.map((page) => (
            <label key={page.number}>
              {t.page} {page.number} ·{' '}
              {page.source === 'ocr' ? 'OCR' : t.embedded}
              <textarea readOnly rows={8} value={page.text || t.empty} />
            </label>
          ))}
        </>
      )}
    </section>
  );
}
