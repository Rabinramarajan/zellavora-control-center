import fs from 'fs';
import path from 'path';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';

/** Every column except the file bytes, so listings never pull blobs into memory. */
const MEDIA_METADATA = {
  id: true,
  folder: true,
  name: true,
  pathname: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

export class StorageRepository extends BaseRepository {
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

  async listMedia(
    organizationId: string,
    options: { prefix?: string; offset: number; limit: number },
    tx?: TxClient
  ) {
    return this.getDb(tx).mediaFile.findMany({
      where: {
        organizationId,
        ...(options.prefix ? { pathname: { startsWith: options.prefix } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: options.offset,
      // One extra row tells us whether another page exists.
      take: options.limit + 1,
      select: MEDIA_METADATA,
    });
  }

  async findByPathname(organizationId: string, pathname: string, tx?: TxClient) {
    return this.getDb(tx).mediaFile.findUnique({
      where: { organizationId_pathname: { organizationId, pathname } },
    });
  }

  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).mediaFile.findUnique({ where: { id } });
  }

  async pathnameExists(organizationId: string, pathname: string, tx?: TxClient): Promise<boolean> {
    const count = await this.getDb(tx).mediaFile.count({ where: { organizationId, pathname } });
    return count > 0;
  }

  async createMedia(
    data: {
      organizationId: string;
      folder: string;
      name: string;
      pathname: string;
      mimeType: string;
      size: number;
      data: Buffer;
      createdBy: string | null;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).mediaFile.create({ data, select: MEDIA_METADATA });
  }

  async deleteByPathname(organizationId: string, pathname: string, tx?: TxClient): Promise<number> {
    const result = await this.getDb(tx).mediaFile.deleteMany({
      where: { organizationId, pathname },
    });
    return result.count;
  }
}
