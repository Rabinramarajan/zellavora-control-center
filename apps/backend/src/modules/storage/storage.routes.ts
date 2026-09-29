import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
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

/**
 * @swagger
 * /api/v1/storage/media:
 *   get:
 *     summary: listMedia
 *     description: Lists files in the Vercel Blob store, newest pages first via cursor pagination.
 *     operationId: getStorageMedia
 *     tags: [storage]
 *     parameters:
 *       - { in: query, name: prefix, schema: { type: string } }
 *       - { in: query, name: cursor, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 1000 } }
 *     responses:
 *       default:
 *         description: Operation response
 *   delete:
 *     summary: deleteMedia
 *     operationId: deleteStorageMedia
 *     tags: [storage]
 *     parameters:
 *       - { in: query, name: pathname, required: true, schema: { type: string } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/media', authenticate, controller.listMedia);
router.delete('/media', authenticate, requirePermission('media:delete'), controller.deleteMedia);

/**
 * @swagger
 * /api/v1/storage/media/file:
 *   get:
 *     summary: streamMedia
 *     description: Streams a blob's content; required for previewing files in a private store.
 *     operationId: getStorageMediaFile
 *     tags: [storage]
 *     parameters:
 *       - { in: query, name: pathname, required: true, schema: { type: string } }
 *       - { in: query, name: access, schema: { type: string, enum: [public, private] } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/media/file', authenticate, controller.streamMedia);

export default router;
