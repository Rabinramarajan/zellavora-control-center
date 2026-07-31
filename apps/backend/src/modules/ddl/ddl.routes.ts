import { Router } from 'express';
import { DdlController } from './ddl.controller';

const router = Router();
const controller = new DdlController();

router.get('/', controller.getAll);
router.get('/types', controller.getByTypes);
router.get('/:type', controller.getByType);

export default router;
