import fs from 'fs';
import path from 'path';
import {
  BlobAccessError,
  BlobError,
  BlobNotFoundError,
  BlobStoreNotFoundError,
  del,
  get,
  list,
} from '@vercel/blob';
import { AppError } from '../../middleware/error';
import type { BlobAccess, BlobContent, BlobPage } from './storage.types';

export class StorageRepository {
  async saveFile(fileName: string, base64Data: string): Promise<string> {
    const dir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/scratch/${fileName}`;
  }

  async listBlobs(options: { prefix?: string; cursor?: string; limit?: number }): Promise<BlobPage> {
    const result = await withBlobErrors(() => list(options));
    return {
      blobs: result.blobs.map((blob) => ({
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        access: accessOf(blob.url),
      })),
      cursor: result.cursor,
      hasMore: result.hasMore,
    };
  }

  async openBlob(pathname: string, access: BlobAccess): Promise<BlobContent> {
    const result = await withBlobErrors(() => get(pathname, { access }));
    if (!result || result.statusCode !== 200) {
      throw new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND');
    }
    return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  }

  async deleteBlob(urlOrPathname: string): Promise<void> {
    await withBlobErrors(() => del(urlOrPathname));
  }
}

/**
 * The SDK resolves credentials itself (BLOB_READ_WRITE_TOKEN, or the per-request Vercel
 * OIDC token + BLOB_STORE_ID), so misconfiguration only surfaces as a thrown BlobError.
 * Translate those into actionable API errors instead of generic 500s.
 */
async function withBlobErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      throw new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND');
    }
    if (err instanceof BlobStoreNotFoundError) {
      throw new AppError('The configured Blob store does not exist', 503, 'BLOB_STORE_NOT_FOUND');
    }
    if (err instanceof BlobAccessError) {
      throw new AppError(
        'Blob credentials were rejected; check the token belongs to this store',
        503,
        'BLOB_ACCESS_DENIED'
      );
    }
    if (err instanceof BlobError && /credentials|token/i.test(err.message)) {
      throw new AppError(
        'Media storage is not configured: set BLOB_READ_WRITE_TOKEN, or connect the Blob store to this Vercel project',
        503,
        'BLOB_NOT_CONFIGURED'
      );
    }
    throw err;
  }
}

/** Blob hostnames encode the store's access level: <store>.public|private.blob.vercel-storage.com */
function accessOf(url: string): BlobAccess {
  return new URL(url).hostname.includes('.private.') ? 'private' : 'public';
}
