export type BlobAccess = 'public' | 'private';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface BlobFile {
  url: string;
  downloadUrl: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
  access: BlobAccess;
}

export interface BlobPage {
  blobs: BlobFile[];
  cursor?: string;
  hasMore: boolean;
}

export interface MediaItem {
  pathname: string;
  name: string;
  folder: string;
  type: MediaType;
  mimeType: string;
  size: number;
  uploadedAt: string;
  access: BlobAccess;
  /** Directly loadable by the browser only when `access` is public. */
  url: string;
  downloadUrl: string;
}

export interface MediaPage {
  items: MediaItem[];
  cursor: string | null;
  hasMore: boolean;
}

export interface BlobContent {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}
