import { Router } from 'express';
import { DdlController } from './ddl.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new DdlController();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/lookups:
 *   get:
 *     summary: listLookupData
 *     operationId: getLookups
 *     tags: [lookups]
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
