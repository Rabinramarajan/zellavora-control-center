import fs from 'fs';
import path from 'path';
import { del, get, list } from '@vercel/blob';
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
    this.assertConfigured();
    const result = await list(options);
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
    this.assertConfigured();
    const result = await get(pathname, { access });
    if (!result || result.statusCode !== 200) {
      throw new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND');
    }
    return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  }

  async deleteBlob(urlOrPathname: string): Promise<void> {
    this.assertConfigured();
    await del(urlOrPathname);
  }

  private assertConfigured(): void {
    // The SDK only surfaces a generic "No token found" error, which would read as a 500.
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
      throw new AppError(
        'Media storage is not configured (BLOB_READ_WRITE_TOKEN is missing)',
        503,
        'BLOB_NOT_CONFIGURED'
      );
    }
  }
}

/** Blob hostnames encode the store's access level: <store>.public|private.blob.vercel-storage.com */
function accessOf(url: string): BlobAccess {
  return new URL(url).hostname.includes('.private.') ? 'private' : 'public';
}
