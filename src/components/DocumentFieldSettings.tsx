'use client';

import { useState } from 'react';
import {
  availableFields,
  documentTypes,
  fieldLabel,
  maxDocumentFields,
  visibleFields,
  type DocumentType,
  type FieldSettings,
} from '@/lib/document-ai-fields';
import { useAdminLanguage } from './AdminLanguage';
import { documentAiCopy } from './document-ai-copy';

export default function DocumentFieldSettings({
  settings,
  change,
}: {
  settings: FieldSettings;
  change: (next: FieldSettings) => void;
}) {
  const { locale } = useAdminLanguage();
  const t = documentAiCopy[locale];
  const [scope, setScope] = useState<DocumentType | 'all'>('all');
  const [label, setLabel] = useState('');
  const selected =
    scope === 'all' ? settings.common : visibleFields(settings, scope);

  function save(base: FieldSettings, keys: string[]) {
    change(
      scope === 'all'
        ? { ...base, common: keys }
        : { ...base, overrides: { ...base.overrides, [scope]: keys } },
    );
  }

  return (
    <details className="admin-card document-settings">
      <summary>{t.settings}</summary>
      <label>
        {t.kind}
        <select
          value={scope}
          onChange={(event) =>
            setScope(event.target.value as DocumentType | 'all')
          }
        >
          <option value="all">{t.allTypes}</option>
          {Object.entries(documentTypes).map(([id, name]) => (
            <option key={id} value={id}>
              {name[locale]}
            </option>
          ))}
        </select>
      </label>
      {scope !== 'all' && settings.overrides[scope] && (
        <button
          type="button"
          className="button secondary small"
          onClick={() => {
            const overrides = { ...settings.overrides };
            delete overrides[scope];
            change({ ...settings, overrides });
          }}
        >
          {t.reset}
        </button>
      )}
      <div className="document-field-options">
        {availableFields(settings).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(event) => {
                save(
                  settings,
                  event.target.checked
                    ? [...selected, key]
                    : selected.filter((item) => item !== key),
                );
              }}
            />
            {fieldLabel(key, settings, locale)}
          </label>
        ))}
      </div>
      {availableFields(settings).length < maxDocumentFields && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!label.trim()) return;
            const key = 'custom-' + crypto.randomUUID();
            save(
              {
                ...settings,
                custom: { ...settings.custom, [key]: label.trim() },
              },
              [...selected, key],
            );
            setLabel('');
          }}
        >
          <label>
            {t.newField}
            <input
              value={label}
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              required
            />
          </label>
          <button className="button secondary small">{t.addField}</button>
        </form>
      )}
    </details>
  );
}
