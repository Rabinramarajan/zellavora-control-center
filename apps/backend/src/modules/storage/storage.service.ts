import { StorageRepository } from './storage.repository';
import { AppError } from '../../middleware/error';
import { MAX_MEDIA_BYTES } from './storage.dto';
import type { ListMediaQuery, MediaPathQuery, UploadMediaInput } from './storage.dto';
import type { MediaAccess, MediaContent, MediaItem, MediaPage, MediaType } from './storage.types';

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
  md: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

interface MediaMetadata {
  id: string;
  folder: string;
  name: string;
  pathname: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export class StorageService {
  private readonly repo = new StorageRepository();

  async uploadFile(fileName: string, base64Data: string) {
    const extension = fileName.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const url = await this.repo.saveFile(uniqueName, base64Data);
    return { url, name: uniqueName };
  }

  async listMedia(query: ListMediaQuery, tenantId: string, publicBaseUrl: string): Promise<MediaPage> {
    const offset = query.cursor ? Number(query.cursor) : 0;
    const rows = await this.repo.listMedia(requireTenant(tenantId), {
      prefix: query.prefix,
      offset,
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    return {
      items: rows.slice(0, query.limit).map((row) => toMediaItem(row, publicBaseUrl)),
      cursor: hasMore ? String(offset + query.limit) : null,
      hasMore,
    };
  }

  async uploadMedia(
    input: UploadMediaInput,
    tenantId: string,
    userId: string | undefined,
    publicBaseUrl: string
  ): Promise<MediaItem> {
    const organizationId = requireTenant(tenantId);
    const data = Buffer.from(input.base64Data.replace(/^data:[^;,]*;base64,/, ''), 'base64');
    if (data.length === 0) {
      throw new AppError('File is empty', 400, 'MEDIA_EMPTY');
    }
    if (data.length > MAX_MEDIA_BYTES) {
      throw new AppError(
        `File exceeds the ${MAX_MEDIA_BYTES / (1024 * 1024)} MB upload limit`,
        413,
        'MEDIA_TOO_LARGE'
      );
    }

    const name = await this.availableName(organizationId, input.folder, input.fileName);
    const row = await this.repo.createMedia({
      organizationId,
      folder: input.folder,
      name,
      pathname: joinPath(input.folder, name),
      mimeType: input.mimeType || mimeTypeOf(name),
      size: data.length,
      data,
      createdBy: userId ?? null,
    });
    return toMediaItem(row, publicBaseUrl);
  }

  async openMedia(query: MediaPathQuery, tenantId: string): Promise<MediaContent> {
    const row = await this.repo.findByPathname(requireTenant(tenantId), query.pathname);
    if (!row) throw new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND');
    return { data: Buffer.from(row.data), name: row.name, mimeType: row.mimeType, size: row.size };
  }

  /** Serves `public` media by id: the unguessable UUID is the capability, like a Blob URL. */
  async openPublicMedia(id: string): Promise<MediaContent> {
    const row = await this.repo.findById(id);
    if (!row || accessOf(row.mimeType) !== 'public') {
      throw new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND');
    }
    return { data: Buffer.from(row.data), name: row.name, mimeType: row.mimeType, size: row.size };
  }

  async deleteMedia(query: MediaPathQuery, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteByPathname(requireTenant(tenantId), query.pathname);
    if (deleted === 0) throw new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND');
  }

  /** Appends " (n)" before the extension until the pathname is free, like a desktop file manager. */
  private async availableName(organizationId: string, folder: string, fileName: string): Promise<string> {
    const dot = fileName.lastIndexOf('.');
    const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
    const extension = dot > 0 ? fileName.slice(dot) : '';
    let candidate = fileName;
    for (let n = 1; await this.repo.pathnameExists(organizationId, joinPath(folder, candidate)); n++) {
      candidate = `${stem} (${n})${extension}`;
    }
    return candidate;
  }
}

function requireTenant(tenantId: string | undefined): string {
  if (!tenantId) {
    throw new AppError('Media Library requires an organization context', 403, 'TENANT_REQUIRED');
  }
  return tenantId;
}

function joinPath(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

function toMediaItem(row: MediaMetadata, publicBaseUrl: string): MediaItem {
  const url = `${publicBaseUrl}/${row.id}`;
  return {
    id: row.id,
    pathname: row.pathname,
    name: row.name,
    folder: row.folder,
    type: mediaTypeOf(row.mimeType),
    mimeType: row.mimeType,
    size: row.size,
    uploadedAt: row.createdAt.toISOString(),
    access: accessOf(row.mimeType),
    url,
    downloadUrl: `${url}?download=1`,
  };
}

/**
 * Images, video and audio get a direct URL so thumbnails and players can load them.
 * Documents stay behind the authenticated endpoint; the UI previews them as object URLs.
 */
function accessOf(mimeType: string): MediaAccess {
  const type = mediaTypeOf(mimeType);
  return type === 'image' || type === 'video' || type === 'audio' ? 'public' : 'private';
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
