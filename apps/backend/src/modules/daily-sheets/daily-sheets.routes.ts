import { Router } from 'express';
import { DailySheetsController } from './daily-sheets.controller';
import { authGuard } from '../../middleware/auth';

const router = Router();
const controller = new DailySheetsController();

router.use(authGuard);

/**
 * @route POST /api/v1/daily-sheets
 * @description Create a new daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets:
 *   post:
 *     summary: createDailySheet
 *     operationId: postDailySheets
 *     tags: [daily-sheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', (req, res) => controller.create(req as any, res));

/**
 * @route GET /api/v1/daily-sheets
 * @description List daily sheets with filtering
 */
/**
 * @swagger
 * /api/v1/daily-sheets:
 *   get:
 *     summary: listDailySheets
 *     operationId: getDailySheets
 *     tags: [daily-sheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', (req, res) => controller.list(req as any, res));

/**
 * @route GET /api/v1/daily-sheets/:id
 * @description Get a specific daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}:
 *   get:
 *     summary: getDailySheetById
 *     operationId: getDailySheetsById
 *     tags: [daily-sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/:id', (req, res) => controller.getById(req as any, res));

/**
 * @route PUT /api/v1/daily-sheets/:id
 * @description Update a daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}:
 *   put:
 *     summary: updateDailySheet
 *     operationId: putDailySheetsById
 *     tags: [daily-sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put('/:id', (req, res) => controller.update(req as any, res));

/**
 * @route POST /api/v1/daily-sheets/:id/submit
 * @description Submit daily sheet for approval
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}/submit:
 *   post:
 *     summary: submitDailySheet
 *     operationId: postDailySheetsByIdSubmit
 *     tags: [daily-sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/:id/submit', (req, res) => controller.submit(req as any, res));

/**
 * @route POST /api/v1/daily-sheets/:id/approve
 * @description Approve or reject a daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}/approve:
 *   post:
 *     summary: approveDailySheet
 *     operationId: postDailySheetsByIdApprove
 *     tags: [daily-sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/:id/approve', (req, res) => controller.approve(req as any, res));

/**
 * @route DELETE /api/v1/daily-sheets/:id
 * @description Delete a daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}:
 *   delete:
 *     summary: deleteDailySheet
 *     operationId: deleteDailySheetsById
 *     tags: [daily-sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.delete('/:id', (req, res) => controller.delete(req as any, res));

export default router;
