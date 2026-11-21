export const bytesPerMiB = 1024 * 1024;
export const documentLimitRanges = {
  fileMiB: { min: 1, max: 30 },
  pages: { min: 1, max: 50 },
  timeoutSeconds: { min: 15, max: 300 },
} as const;
export type DocumentLimits = Record<keyof typeof documentLimitRanges, number>;
export const defaultDocumentLimits: DocumentLimits = {
  fileMiB: 10,
  pages: 12,
  timeoutSeconds: 90,
};
export const documentLanguages = {
  auto: 'lav+eng+rus',
  lv: 'lav',
  en: 'eng',
  ru: 'rus+eng',
} as const;
export type DocumentLanguage = keyof typeof documentLanguages;

export type DocumentPage = {
  number: number;
  source: 'embedded' | 'ocr';
  text: string;
  lowConfidenceWords?: string[];
};
