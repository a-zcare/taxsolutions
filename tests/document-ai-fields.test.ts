import { describe, expect, it } from 'vitest';
import {
  captureFields,
  defaultFieldSettings,
  detectDocumentType,
  readFieldSettings,
  visibleFields,
} from '../src/lib/document-ai-fields';
import type { DocumentPage } from '../src/lib/document-ai-options';

const invoice: DocumentPage = {
  number: 1,
  source: 'ocr',
  text: 'Rēķins Nr. 159\nDatums: 21.11.2026\nSumma bez PVN 100,00 EUR\nPVN 21,00 EUR\nKopā apmaksai 120,00 EUR',
  lowConfidenceWords: ['159'],
};

describe('document field review', () => {
  it('marks weak, missing and inconsistent values for review', () => {
    expect(detectDocumentType([invoice])).toBe('invoice');
    const fields = captureFields(
      [invoice],
      ['number', 'date', 'iban', 'total'],
      defaultFieldSettings,
    );
    expect(fields.number).toMatchObject({ value: '159', uncertain: true });
    expect(fields.date).toMatchObject({
      value: '21.11.2026',
      uncertain: false,
    });
    expect(fields.iban).toMatchObject({ value: '', uncertain: true });
    expect(fields.total).toMatchObject({
      value: '120,00 EUR',
      uncertain: true,
    });
  });

  it('uses an explicit type layout and inherits shared fields otherwise', () => {
    const settings = readFieldSettings(
      JSON.stringify({
        common: ['total'],
        overrides: { receipt: [] },
        custom: {},
      }),
    );
    expect(visibleFields(settings, 'receipt')).toEqual([]);
    expect(visibleFields(settings, 'invoice')).toEqual(['total']);
  });
});
