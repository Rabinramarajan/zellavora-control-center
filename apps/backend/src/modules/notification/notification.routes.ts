import { Router } from 'express';
import { NotificationController } from './notification.controller';

const router = Router();
const controller = new NotificationController();

router.get('/', controller.list);
router.post('/send', controller.send);

export default router;
