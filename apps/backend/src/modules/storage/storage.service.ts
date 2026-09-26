import { StorageRepository } from './storage.repository';
import type { ListMediaQuery, MediaPathQuery } from './storage.dto';
import type { BlobContent, BlobFile, MediaItem, MediaPage, MediaType } from './storage.types';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export class StorageService {
  private readonly repo = new StorageRepository();

  async uploadFile(fileName: string, base64Data: string) {
    const extension = fileName.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const url = await this.repo.saveFile(uniqueName, base64Data);
    return { url, name: uniqueName };
  }

  async listMedia(query: ListMediaQuery): Promise<MediaPage> {
    const page = await this.repo.listBlobs(query);
    return {
      // The Blob API lists folder placeholders as zero-byte entries ending in '/'.
      items: page.blobs.filter((blob) => !blob.pathname.endsWith('/')).map(toMediaItem),
      cursor: page.cursor ?? null,
      hasMore: page.hasMore,
    };
  }

  openMedia(query: MediaPathQuery): Promise<BlobContent> {
    return this.repo.openBlob(query.pathname, query.access);
  }

  deleteMedia(query: MediaPathQuery): Promise<void> {
    return this.repo.deleteBlob(query.pathname);
  }
}

function toMediaItem(blob: BlobFile): MediaItem {
  const segments = blob.pathname.split('/');
  const name = segments.pop() ?? blob.pathname;
  const mimeType = mimeTypeOf(name);
  return {
    pathname: blob.pathname,
    name,
    folder: segments.join('/'),
    type: mediaTypeOf(mimeType),
    mimeType,
    size: blob.size,
    uploadedAt: new Date(blob.uploadedAt).toISOString(),
    access: blob.access,
    url: blob.url,
    downloadUrl: blob.downloadUrl,
  };
}

function mimeTypeOf(fileName: string): string {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function mediaTypeOf(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/octet-stream') return 'other';
  return 'document';
}
