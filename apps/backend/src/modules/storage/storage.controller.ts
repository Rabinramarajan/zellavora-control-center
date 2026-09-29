import { Request, Response, NextFunction } from 'express';
import { StorageService } from './storage.service';
import {
  ListMediaQuerySchema,
  MediaIdParamSchema,
  MediaPathQuerySchema,
  UploadFileSchema,
  UploadMediaSchema,
} from './storage.dto';
import type { MediaContent } from './storage.types';
import type { AuthRequest } from '../../middleware/auth';

/** Absolute base for public media links; the browser loads them from the frontend's origin. */
const publicBaseUrl = (req: Request): string =>
  `${req.protocol}://${req.get('host')}${req.baseUrl}/media/public`;

// SVG can carry script; the sandbox CSP neutralises it when opened directly.
const sendContent = (res: Response, content: MediaContent, download: boolean, cacheControl: string) => {
  res.setHeader('Content-Type', content.mimeType);
  res.setHeader('Content-Length', String(content.size));
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(content.name)}`
  );
  res.end(content.data);
};

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

  listMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = ListMediaQuerySchema.parse(req.query);
      res.json({
        success: true,
        data: await this.service.listMedia(query, req.tenantId as string, publicBaseUrl(req)),
      });
    } catch (err) {
      next(err);
    }
  };

  uploadMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const input = UploadMediaSchema.parse(req.body);
      const item = await this.service.uploadMedia(
        input,
        req.tenantId as string,
        req.userId,
        publicBaseUrl(req)
      );
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  streamMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = MediaPathQuerySchema.parse(req.query);
      const content = await this.service.openMedia(query, req.tenantId as string);
      sendContent(res, content, false, 'private, max-age=300');
    } catch (err) {
      next(err);
    }
  };

  streamPublicMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = MediaIdParamSchema.parse(req.params);
      const content = await this.service.openPublicMedia(id);
      // Helmet defaults to same-origin, which would block <img> tags on the frontend origin.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      sendContent(res, content, req.query.download === '1', 'public, max-age=86400, immutable');
    } catch (err) {
      next(err);
    }
  };

  deleteMedia = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = MediaPathQuerySchema.parse(req.query);
      await this.service.deleteMedia(query, req.tenantId as string);
      res.json({ success: true, data: { pathname: query.pathname } });
    } catch (err) {
      next(err);
    }
  };
}
