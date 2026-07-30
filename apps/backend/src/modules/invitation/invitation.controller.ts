import { Request, Response, NextFunction } from 'express';
import { InvitationService } from './invitation.service';
import { VerifyInvitationSchema, GenerateInvitationSchema } from './invitation.dto';

export class InvitationController {
  private readonly service = new InvitationService();

  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = VerifyInvitationSchema.parse(req.body);
      const invite = await this.service.verify(data.code);
      res.json({ success: true, data: invite });
    } catch (err) {
      next(err);
    }
  };

  generate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = GenerateInvitationSchema.parse(req.body);
      const invite = await this.service.generate(data.email);
      res.json({ success: true, data: invite });
    } catch (err) {
      next(err);
    }
  };
}
