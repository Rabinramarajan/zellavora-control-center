import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginSchema, LoginMfaSchema, RefreshTokenSchema } from './auth.dto';

export class AuthController {
  private readonly service = new AuthService();

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await this.service.login(data.identifier, data.password);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  mfa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = LoginMfaSchema.parse(req.body);
      const result = await this.service.verifyMfaChallenge(data.userId, data.code);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = RefreshTokenSchema.parse(req.body);
      const result = await this.service.refreshUserTokens(data.refreshToken);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
