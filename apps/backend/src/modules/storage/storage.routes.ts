import { Router } from 'express';
import { StorageController } from './storage.controller';

const router = Router();
const controller = new StorageController();

router.post('/upload', controller.upload);

export default router;
