export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'other';

export type MediaAccess = 'public' | 'private';

/** A file stored in the media_files table, as returned by GET /storage/media. */
export interface MediaItem {
  id: string;
  pathname: string;
  name: string;
  folder: string;
  type: MediaKind;
  mimeType: string;
  size: number;
  uploadedAt: string;
  access: MediaAccess;
  url: string;
  downloadUrl: string;
}

export interface MediaPage {
  items: MediaItem[];
  cursor: string | null;
  hasMore: boolean;
}

export interface MediaListParams {
  prefix?: string;
  cursor?: string;
  limit?: number;
}
