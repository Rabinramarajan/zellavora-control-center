import { Router } from 'express';
import { StorageController } from './storage.controller';

const router = Router();
const controller = new StorageController();

/**
 * @swagger
 * /api/v1/storage/upload:
 *   post:
 *     summary: uploadFile
 *     operationId: postStorageUpload
 *     tags: [storage]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/upload', controller.upload);

export default router;
