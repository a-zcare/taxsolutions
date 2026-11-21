import { describe, expect, it } from 'vitest';
import {
  extractTemplateValue,
  findDocumentAnchor,
  layoutFromTsv,
  matchingDocumentTemplates,
  type DocumentTemplate,
} from '../src/lib/document-ai-regions';

function layout(top: number, amount: string, confidence = 98) {
  return layoutFromTsv(
    [
      '1\t1\t0\t0\t0\t0\t0\t0\t1000\t1000\t-1\t',
      `5\t1\t1\t1\t1\t1\t100\t${top}\t100\t20\t98\tAmount`,
      `5\t1\t1\t1\t1\t2\t210\t${top}\t70\t20\t98\tdue`,
      `5\t1\t1\t1\t1\t3\t620\t${top}\t140\t20\t${confidence}\t${amount}`,
    ].join('\n'),
  );
}

const rule: DocumentTemplate = {
  id: 'rule',
  type: 'invoice',
  matchText: 'Baltic Example Ltd',
  field: 'total',
  label: 'Total amount',
  page: 1,
  region: { x: 0.6, y: 0.3, width: 0.2, height: 0.04 },
  anchor: 'Amount due',
  anchorOffset: { x: 0.5, y: 0 },
};

describe('document recognition rules', () => {
  it('reads a new value after the anchor moves down the page', () => {
    expect(findDocumentAnchor(layout(300, '42.50'), rule.anchor)).toMatchObject(
      { x: 0.1, y: 0.3 },
    );
    expect(extractTemplateValue(rule, layout(480, '83.17'))).toMatchObject({
      page: 1,
      value: '83.17',
      region: { y: 0.48 },
    });
  });

  it('leaves weak, missing or repeated anchors for manual review', () => {
    expect(
      extractTemplateValue(rule, layout(480, '83.17', 40)),
    ).toBeUndefined();
    expect(extractTemplateValue(rule, [])).toBeUndefined();
    expect(
      extractTemplateValue(rule, [
        ...layout(480, '83.17'),
        ...layout(550, '50'),
      ]),
    ).toBeUndefined();
  });

  it('matches by supplier, document type and page', () => {
    const pages = [
      {
        number: 1,
        text: 'Invoice for BALTIC EXAMPLE LTD.',
        source: 'embedded' as const,
      },
    ];
    expect(matchingDocumentTemplates([rule], 'invoice', pages)).toEqual([rule]);
    expect(matchingDocumentTemplates([rule], 'receipt', pages)).toEqual([]);
    expect(
      matchingDocumentTemplates([rule], 'invoice', [
        { ...pages[0], text: 'Baltic Example Lts' },
      ]),
    ).toEqual([]);
  });
});
