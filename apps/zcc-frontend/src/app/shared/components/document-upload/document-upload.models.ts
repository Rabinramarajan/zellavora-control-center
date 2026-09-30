export interface DocumentUploadResult {
  uploadedBy?: string;
  uploadedOn?: string;
}

/** Resolve only after the server has persisted the file; reject to enable retry. */
export type DocumentUploadHandler = (
  file: File,
  progress: (percent: number) => void
) => Promise<DocumentUploadResult>;

export interface UploadDocument {
  id: string;
  file: File;
  status: 'ready' | 'uploading' | 'uploaded' | 'failed';
  progress?: number;
  uploadedBy?: string;
  uploadedOn?: string;
  error?: string;
}

export interface DocumentUploadDialogData {
  uploadFile: DocumentUploadHandler;
  title?: string;
  subtitle?: string;
  /** Per-file limit in MB. Defaults to 25. */
  maxSizeMb?: number;
}

const OFFICE_ZIP = ['application/zip', 'application/x-zip-compressed'];

/** Accepted extensions mapped to the MIME types browsers report for them. */
export const DOCUMENT_UPLOAD_TYPES: Readonly<Record<string, readonly string[]>> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  webm: ['video/webm', 'audio/webm'],
  json: ['application/json', 'text/json', 'text/plain'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ...OFFICE_ZIP],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ...OFFICE_ZIP],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
};

export const DOCUMENT_UPLOAD_ACCEPT = Object.keys(DOCUMENT_UPLOAD_TYPES)
  .map((extension) => `.${extension}`)
  .join(',');

export const DOCUMENT_UPLOAD_LABEL = 'PDF, images, videos, JSON, Markdown, Word and Excel';
