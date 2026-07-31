import { Request, Response, NextFunction } from 'express';
import { DdlService } from './ddl.service';

const KNOWN_TYPES = ['country', 'language', 'gender', 'industry', 'organization_size', 'timezone', 'use_case'];

export class DdlController {
  private readonly service = new DdlService();

  /** GET / — load all DDL lists grouped by type */
  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getAll();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /types — load only the requested DDL lists (query: ?type=country,language,gender) */
  getByTypes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = (req.query.type as string | undefined) ?? '';
      const types = raw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const data = await this.service.getByTypes(types);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /:type — load a single DDL list */
  getByType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.params.type;
      if (!KNOWN_TYPES.includes(type)) {
        res.status(404).json({ success: false, message: `Unknown DDL type '${type}'` });
        return;
      }
      const data = await this.service.getByType(type);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
