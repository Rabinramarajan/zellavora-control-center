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
 *     summary: Create daily sheet
 *     operationId: postDailySheets
 *     tags: [Daily Sheets]
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
 *     summary: List daily sheets
 *     operationId: getDailySheets
 *     tags: [Daily Sheets]
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
 *     summary: Get daily sheet by ID
 *     operationId: getDailySheetsById
 *     tags: [Daily Sheets]
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
 *     summary: Update daily sheet
 *     operationId: putDailySheetsById
 *     tags: [Daily Sheets]
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
 *     summary: Submit daily sheet
 *     operationId: postDailySheetsByIdSubmit
 *     tags: [Daily Sheets]
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
 *     summary: Approve daily sheet
 *     operationId: postDailySheetsByIdApprove
 *     tags: [Daily Sheets]
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
 *     summary: Delete daily sheet
 *     operationId: deleteDailySheetsById
 *     tags: [Daily Sheets]
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
