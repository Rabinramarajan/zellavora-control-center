import { Router } from 'express';
import { OrganizationController } from './organization.controller';

const router = Router();
const controller = new OrganizationController();

router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);

export default router;
