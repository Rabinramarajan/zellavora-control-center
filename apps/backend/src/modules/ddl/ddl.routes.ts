import { Router } from 'express';
import { DdlController } from './ddl.controller';

const router = Router();
const controller = new DdlController();

/**
 * @swagger
 * /api/v1/lookups:
 *   get:
 *     summary: List lookup data
 *     operationId: getLookups
 *     tags: [Lookups]
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
 *     summary: List lookup data by types
 *     operationId: getLookupsTypes
 *     tags: [Lookups]
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
 *     summary: List lookup data by type
 *     operationId: getLookupsByType
 *     tags: [Lookups]
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
