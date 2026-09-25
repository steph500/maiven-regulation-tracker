export interface RegulationDocument {
  id: string;
  document_number: string;
  title: string;
  abstract: string | null;
  publication_date: string;
  effective_on: string | null;
  agencies: Array<{ name?: string | null; [key: string]: unknown }>;
  html_url: string;
  current_version: number;
}

export interface DocumentPage {
  items: RegulationDocument[];
  total: number;
  offset: number;
  pageSize: 20;
  nextOffset: number | null;
  hasMore: boolean;
}

export interface DocumentVersion extends Omit<RegulationDocument, 'current_version'> {
  version_number: number;
  captured_at: string;
}

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';
