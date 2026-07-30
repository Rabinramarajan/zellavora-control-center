import { Router } from 'express';
import { InvitationController } from './invitation.controller';

const router = Router();
const controller = new InvitationController();

router.post('/verify', controller.verify);
router.post('/generate', controller.generate);

export default router;
