import { Router } from 'express';
import { BranchController } from './branch.controller';

const router = Router();
const controller = new BranchController();

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);

export default router;
