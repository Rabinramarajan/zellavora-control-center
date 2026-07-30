import { Request, Response, NextFunction } from 'express';
import { VerificationService } from './verification.service';
import { RequestOtpSchema, VerifyOtpSchema } from './verification.dto';

export class VerificationController {
  private readonly service = new VerificationService();

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = RequestOtpSchema.parse(req.body);
      const result = await this.service.sendOtp(data.type, data.target);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = VerifyOtpSchema.parse(req.body);
      const result = await this.service.verifyOtp(data.type, data.target, data.code);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
