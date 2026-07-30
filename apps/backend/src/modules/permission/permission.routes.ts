import { Router } from 'express';
import { PermissionController } from './permission.controller';

const router = Router();
const controller = new PermissionController();

router.get('/', controller.list);
router.post('/', controller.create);
router.post('/assign', controller.assign);

export default router;
