import { Router } from 'express';
import { AuditController } from './audit.controller';

const router = Router();
const controller = new AuditController();

router.get('/', controller.list);
router.post('/log', controller.log);

export default router;
