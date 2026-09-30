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
