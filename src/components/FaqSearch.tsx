'use client';
import { useMemo, useState } from 'react';
import type { FaqItem } from '@/lib/v2/faq';
import type { Locale } from '@/lib/i18n';
import { workspaceLabel } from '@/lib/v2/ui';
export default function FaqSearch({
  items,
  locale,
  bookLabel,
}: {
  items: FaqItem[];
  locale: Locale;
  bookLabel: string;
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('');
  const t = (s: string) => workspaceLabel(s, locale);
  const matches = useMemo(() => {
    const tokens = query
      .normalize('NFKC')
      .toLocaleLowerCase(locale)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return items.filter(
      (i) =>
        (!category || i.category === category) &&
        tokens.every((token) =>
          `${i.question} ${i.answer}`
            .normalize('NFKC')
            .toLocaleLowerCase(locale)
            .includes(token),
        ),
    );
  }, [items, query, category, locale]);
  return (
    <div>
      <div className="faq-search">
        <label>
          {t('Find an answer')}
          <input
            type="search"
            value={query}
            maxLength={120}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {t('Category')}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t('All categories')}</option>
            {[...new Set(items.map((i) => i.category))].map((c) => (
              <option key={c} value={c}>
                {c === 'general' ? t('General') : t(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" className="faq-results">
        {matches.length}
      </p>
      {matches.map((item, i) => (
        <details className="faq-item" key={item.id}>
          <summary>
            <span className="faq-number">{String(i + 1).padStart(2, '0')}</span>
            {item.question}
            <span className="faq-plus">+</span>
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
      {!matches.length && <p>{t('No matching answer. Ask a specialist.')}</p>}
      <a className="button secondary small" href="#booking">
        {bookLabel} ↗
      </a>
    </div>
  );
}
