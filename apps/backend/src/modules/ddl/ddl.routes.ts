import { Router } from 'express';
import { DdlController } from './ddl.controller';

const router = Router();
const controller = new DdlController();

/**
 * @swagger
 * /api/v1/lookups:
 *   get:
 *     summary: listLookupData
 *     operationId: getLookups
 *     tags: [lookups]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.getAll);
/**
 * @swagger
 * /api/v1/lookups/types:
 *   get:
 *     summary: listLookupDataByTypes
 *     operationId: getLookupsTypes
 *     tags: [lookups]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/types', controller.getByTypes);
/**
 * @swagger
 * /api/v1/lookups/{type}:
 *   get:
 *     summary: listLookupDataByType
 *     operationId: getLookupsByType
 *     tags: [lookups]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/:type', controller.getByType);

export default router;
