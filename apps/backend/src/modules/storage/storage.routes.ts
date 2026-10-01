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
 *     description: Lists the organization's media files (media_files table), newest first, offset-cursor paginated.
 *     operationId: getStorageMedia
 *     tags: [storage]
 *     parameters:
 *       - { in: query, name: prefix, schema: { type: string } }
 *       - { in: query, name: cursor, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 1000 } }
 *     responses:
 *       default:
 *         description: Operation response
 *   post:
 *     summary: uploadMedia
 *     description: Stores a base64-encoded file (max 3 MB) in the media_files table.
 *     operationId: postStorageMedia
 *     tags: [storage]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName, base64Data]
 *             properties:
 *               fileName: { type: string }
 *               folder: { type: string }
 *               mimeType: { type: string }
 *               base64Data: { type: string }
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
// `media:create` is the key used before the rename to `media:upload`; roles granted it keep upload access.
router.post(
  '/media',
  authenticate,
  requirePermission('media:upload', 'media:create'),
  controller.uploadMedia
);
router.delete('/media', authenticate, requirePermission('media:delete'), controller.deleteMedia);

/**
 * @swagger
 * /api/v1/storage/media/file:
 *   get:
 *     summary: streamMedia
 *     description: Returns a file's content for the caller's organization; used to preview documents.
 *     operationId: getStorageMediaFile
 *     tags: [storage]
 *     parameters:
 *       - { in: query, name: pathname, required: true, schema: { type: string } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/media/file', authenticate, controller.streamMedia);

/**
 * @swagger
 * /api/v1/storage/media/public/{id}:
 *   get:
 *     summary: streamPublicMedia
 *     description: Serves an image, video or audio file by id so it can be embedded directly.
 *     operationId: getStorageMediaPublic
 *     tags: [storage]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: download, schema: { type: string, enum: ['1'] } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/media/public/:id', controller.streamPublicMedia);

export default router;
