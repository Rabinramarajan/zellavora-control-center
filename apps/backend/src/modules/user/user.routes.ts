import { Router } from 'express';
import { UserController } from './user.controller';

const router = Router();
const controller = new UserController();

router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);

export default router;
