import type { DocumentLanguage, DocumentPage } from './document-ai-options';
import type { DocumentType } from './document-ai-fields';
import type { TemplateValue } from './document-ai-regions';

export const archiveEndpoint = '/api/workspace/document-ai/archive';
export const archiveUploadHeader = 'X-Document-Archive';
export type ArchiveUpload = { clientId: string; period: string; name: string };
export type ArchiveRow = {
  id: string;
  clientId: string;
  period: string;
  name: string;
  status: 'PENDING' | 'CONFIRMED';
  revision: number;
  createdAt: string;
};
export type ArchiveData = {
  language: DocumentLanguage;
  type: DocumentType;
  pages: DocumentPage[];
  templateValues: Record<string, TemplateValue>;
  templateReview: string[];
  edits: Record<string, string>;
  fields?: string[];
  values: Record<string, { label: string; value: string }>;
};
export type ArchiveDetail = ArchiveRow & {
  data: ArchiveData;
  possibleDuplicate: boolean;
  reviewEnabled: boolean;
};

export function archiveHeader(upload: ArchiveUpload) {
  const bytes = new TextEncoder().encode(JSON.stringify(upload));
  return btoa(String.fromCharCode(...bytes));
}
