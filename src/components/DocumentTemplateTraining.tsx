'use client';

import { useState, type FormEvent } from 'react';
import type { DocumentRegion } from '@/lib/document-ai-regions';
import { useAdminLanguage } from './AdminLanguage';
import { templateCopy } from './document-template-copy';

const coords = ['x', 'y', 'width', 'height'] as const;
const defaultRegion = { x: 0.1, y: 0.1, width: 0.2, height: 0.08 };
export default function DocumentTemplateTraining({
  label,
  supplier,
  region,
  onRegion,
  onSave,
  onCancel,
}: {
  label: string;
  supplier: string;
  region: DocumentRegion | null;
  onRegion: (region: DocumentRegion) => void;
  onSave: (
    supplier: string,
    anchor: string,
    region: DocumentRegion,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const { locale } = useAdminLanguage();
  const t = templateCopy[locale];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!region || saving) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await onSave(
        String(fields.get('matchText')),
        String(fields.get('anchor')),
        region,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : '');
    } finally {
      setSaving(false);
    }
  }
  const selection = region ?? defaultRegion;
  const errors: Record<string, string> = {
    TEMPLATE_SUPPLIER_MISSING: t.supplierMissing,
    TEMPLATE_ANCHOR_MISSING: t.anchorMissing,
    TEMPLATE_REGION_EMPTY: t.emptyRegion,
  };
  return (
    <form className="document-fields" onSubmit={submit}>
      <strong>{label}</strong>
      <p>{t.draw}</p>
      <div className="document-region-coordinates">
        {coords.map((key, index) => (
          <label key={key}>
            {t.coords[index]}
            <input
              type="number"
              min={key === 'width' || key === 'height' ? 0.3 : 0}
              max={100}
              step={0.1}
              value={Math.round(selection[key] * 1000) / 10}
              onChange={(event) =>
                onRegion({
                  ...selection,
                  [key]: Number(event.target.value) / 100,
                })
              }
              disabled={saving}
            />
          </label>
        ))}
      </div>
      <label>
        {t.match}
        <input
          name="matchText"
          minLength={4}
          maxLength={100}
          defaultValue={supplier.slice(0, 100)}
          required
          disabled={saving}
        />
      </label>
      <label>
        {t.anchor}
        <input name="anchor" maxLength={100} disabled={saving} />
      </label>
      {error && <p role="alert">{errors[error] ?? t.unavailable}</p>}
      <div className="document-heading">
        <button className="button small" disabled={!region || saving}>
          {t.save}
        </button>
        <button
          className="button secondary small"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
