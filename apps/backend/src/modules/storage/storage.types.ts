export type MediaAccess = 'public' | 'private';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface MediaItem {
  id: string;
  pathname: string;
  name: string;
  folder: string;
  type: MediaType;
  mimeType: string;
  size: number;
  uploadedAt: string;
  /**
   * `public` items are loadable directly from `url` (thumbnails, players);
   * `private` items must be fetched through the authenticated file endpoint.
   */
  access: MediaAccess;
  url: string;
  downloadUrl: string;
}

export interface MediaPage {
  items: MediaItem[];
  cursor: string | null;
  hasMore: boolean;
}

export interface MediaContent {
  data: Buffer;
  name: string;
  mimeType: string;
  size: number;
}
