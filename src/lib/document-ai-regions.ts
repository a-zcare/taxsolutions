import type { DocumentType } from './document-ai-fields';
import type { DocumentPage } from './document-ai-options';

export type DocumentRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type Position = Pick<DocumentRegion, 'x' | 'y'>;
export type DocumentTemplateInput = {
  type: DocumentType;
  matchText: string;
  field: string;
  label: string;
  page: number;
  region: DocumentRegion;
  anchor: string;
};
export type DocumentTemplate = DocumentTemplateInput & {
  id: string;
  anchorOffset?: Position;
};
export type TemplateValue = {
  value: string;
  page: number;
  region: DocumentRegion;
  source: string;
};

type Word = Position & {
  text: string;
  width: number;
  height: number;
  confidence: number;
};
export type DocumentLayout = Word[][];

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function containsDocumentText(text: string, phrase: string) {
  const needle = normalize(phrase);
  return !!needle && ` ${normalize(text)} `.includes(` ${needle} `);
}

export function layoutFromTsv(tsv: string): DocumentLayout {
  let pageWidth = 0;
  let pageHeight = 0;
  const lines = new Map<string, Word[]>();
  for (const row of tsv.split('\n')) {
    const [
      level,
      page,
      block,
      paragraph,
      line,
      ,
      left,
      top,
      width,
      height,
      confidence,
      text,
    ] = row.split('\t');
    if (level === '1') {
      pageWidth = Number(width);
      pageHeight = Number(height);
    }
    if (level !== '5' || !pageWidth || !pageHeight || !text?.trim()) continue;
    const key = `${page}:${block}:${paragraph}:${line}`;
    const words = lines.get(key) ?? [];
    words.push({
      x: Number(left) / pageWidth,
      y: Number(top) / pageHeight,
      width: Number(width) / pageWidth,
      height: Number(height) / pageHeight,
      text: text.trim(),
      confidence: Number(confidence),
    });
    lines.set(key, words);
  }
  return [...lines.values()];
}

export function findDocumentAnchor(
  layout: DocumentLayout,
  anchor: string,
): Position | undefined {
  const target = normalize(anchor);
  if (!target) return;
  const matches: Position[] = [];
  for (const line of layout) {
    const tokens = line.flatMap((word) =>
      normalize(word.text)
        .split(' ')
        .filter(Boolean)
        .map((token) => ({ token, word })),
    );
    const phrase = target.split(' ');
    for (let i = 0; i <= tokens.length - phrase.length; i++)
      if (phrase.every((part, offset) => tokens[i + offset].token === part))
        matches.push(tokens[i].word);
  }
  return matches.length === 1 ? matches[0] : undefined;
}

export function readDocumentRegion(
  layout: DocumentLayout,
  region: DocumentRegion,
  minConfidence = 0,
) {
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > 1.0001 ||
    region.y + region.height > 1.0001
  )
    return '';
  const rows = layout.map((line) =>
    line.filter((word) => {
      const x = word.x + word.width / 2,
        y = word.y + word.height / 2;
      return (
        x >= region.x &&
        x <= region.x + region.width &&
        y >= region.y &&
        y <= region.y + region.height
      );
    }),
  );
  const words = rows.flat();
  if (!words.length || words.some((word) => word.confidence < minConfidence))
    return '';
  const text = rows
    .map((line) => line.map((word) => word.text).join(' '))
    .filter(Boolean)
    .join(' ');
  return text.length <= 180 ? text : '';
}

export function extractTemplateValue(
  template: DocumentTemplate,
  layout: DocumentLayout,
): TemplateValue | undefined {
  let region = template.region;
  if (template.anchor) {
    const anchor = findDocumentAnchor(layout, template.anchor);
    if (!anchor || !template.anchorOffset) return;
    region = {
      ...region,
      x: anchor.x + template.anchorOffset.x,
      y: anchor.y + template.anchorOffset.y,
    };
  }
  const value = readDocumentRegion(layout, region, 65);
  return value
    ? { value, page: template.page, region, source: template.matchText }
    : undefined;
}

export function matchingDocumentTemplates(
  templates: DocumentTemplate[],
  type: DocumentType,
  pages: DocumentPage[],
) {
  const text = pages.map((page) => page.text).join('\n');
  const matches = templates.filter(
    (rule) =>
      rule.type === type &&
      pages.some((page) => page.number === rule.page) &&
      containsDocumentText(text, rule.matchText),
  );
  const identifiers = [
    ...new Set(matches.map((rule) => normalize(rule.matchText))),
  ].sort((a, b) => b.length - a.length);
  if (!identifiers.length || identifiers[1]?.length === identifiers[0].length)
    return [];
  return matches.filter((rule) => normalize(rule.matchText) === identifiers[0]);
}

export const documentTemplateHeader = 'X-Document-Template';
