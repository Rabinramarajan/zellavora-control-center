import { Readable } from 'stream';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import { Request, Response, NextFunction } from 'express';
import { StorageService } from './storage.service';
import { ListMediaQuerySchema, MediaPathQuerySchema, UploadFileSchema } from './storage.dto';

export class StorageController {
  private readonly service = new StorageService();

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UploadFileSchema.parse(req.body);
      const result = await this.service.uploadFile(data.fileName, data.base64Data);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  listMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListMediaQuerySchema.parse(req.query);
      res.json({ success: true, data: await this.service.listMedia(query) });
    } catch (err) {
      next(err);
    }
  };

  /** Streams a blob through the API so private stores can be previewed without exposing the token. */
  streamMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = MediaPathQuerySchema.parse(req.query);
      const { stream, contentType, size } = await this.service.openMedia(query);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(size));
      res.setHeader('Cache-Control', 'private, max-age=300');
      Readable.fromWeb(stream as NodeReadableStream<Uint8Array>)
        .on('error', next)
        .pipe(res);
    } catch (err) {
      next(err);
    }
  };

  deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = MediaPathQuerySchema.parse(req.query);
      await this.service.deleteMedia(query);
      res.json({ success: true, data: { pathname: query.pathname } });
    } catch (err) {
      next(err);
    }
  };
}
