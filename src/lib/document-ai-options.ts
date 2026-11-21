export const maxDocumentBytes = 10 * 1024 * 1024;
export const maxDocumentPages = 12;
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
