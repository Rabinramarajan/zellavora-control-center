import { Router } from 'express';
import { VerificationController } from './verification.controller';

const router = Router();
const controller = new VerificationController();

router.post('/send', controller.send);
router.post('/verify', controller.verify);

export default router;
