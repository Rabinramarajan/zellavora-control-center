import { Router } from 'express';
import { StorageController } from './storage.controller';

const router = Router();
const controller = new StorageController();

/**
 * @swagger
 * /api/v1/storage/upload:
 *   post:
 *     summary: Upload file
 *     operationId: postStorageUpload
 *     tags: [Storage]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/upload', controller.upload);

export default router;
