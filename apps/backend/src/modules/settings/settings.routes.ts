import { Router } from 'express';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

router.get('/', controller.list);
router.get('/:key', controller.get);
router.post('/', controller.save);

export default router;
