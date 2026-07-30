import { Request, Response, NextFunction } from 'express';
import { StorageService } from './storage.service';
import { UploadFileSchema } from './storage.dto';

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
}
