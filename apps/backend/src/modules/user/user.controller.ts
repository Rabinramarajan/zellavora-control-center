import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { CreateUserSchema, UpdateUserSchema } from './user.dto';

export class UserController {
  private readonly service = new UserService();

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.service.getUser(req.params.id);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateUserSchema.parse(req.body) as { email: string; username: string; fullName: string; passwordPlain: string; role?: string };
      const user = await this.service.createUser(data);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateUserSchema.parse(req.body);
      const user = await this.service.updateUser(req.params.id, data);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };
}
