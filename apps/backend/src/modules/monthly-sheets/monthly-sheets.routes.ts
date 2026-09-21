import { Router } from 'express';
import { MonthlySheetsController } from './monthly-sheets.controller';
import { authGuard } from '../../middleware/auth';

const router = Router();
const controller = new MonthlySheetsController();

router.use(authGuard);

/**
 * @route POST /api/v1/monthly-sheets
 * @description Create a new monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets:
 *   post:
 *     summary: Create monthly sheet
 *     operationId: postMonthlySheets
 *     tags: [Monthly Sheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', (req, res) => controller.create(req as any, res));

/**
 * @route GET /api/v1/monthly-sheets
 * @description List monthly sheets with filtering
 */
/**
 * @swagger
 * /api/v1/monthly-sheets:
 *   get:
 *     summary: List monthly sheets
 *     operationId: getMonthlySheets
 *     tags: [Monthly Sheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', (req, res) => controller.list(req as any, res));

/**
 * @route GET /api/v1/monthly-sheets/:id
 * @description Get a specific monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}:
 *   get:
 *     summary: Get monthly sheet by ID
 *     operationId: getMonthlySheetsById
 *     tags: [Monthly Sheets]
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
 * @route PUT /api/v1/monthly-sheets/:id
 * @description Update a monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}:
 *   put:
 *     summary: Update monthly sheet
 *     operationId: putMonthlySheetsById
 *     tags: [Monthly Sheets]
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
 * @route POST /api/v1/monthly-sheets/:id/submit
 * @description Submit monthly sheet for approval
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}/submit:
 *   post:
 *     summary: Submit monthly sheet
 *     operationId: postMonthlySheetsByIdSubmit
 *     tags: [Monthly Sheets]
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
 * @route POST /api/v1/monthly-sheets/:id/approve
 * @description Approve or reject a monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}/approve:
 *   post:
 *     summary: Approve monthly sheet
 *     operationId: postMonthlySheetsByIdApprove
 *     tags: [Monthly Sheets]
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
 * @route POST /api/v1/monthly-sheets/:id/mark-paid
 * @description Mark monthly sheet as paid
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}/mark-paid:
 *   post:
 *     summary: Mark monthly sheet as paid
 *     operationId: postMonthlySheetsByIdMarkPaid
 *     tags: [Monthly Sheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/:id/mark-paid', (req, res) => controller.markAsPaid(req as any, res));

/**
 * @route DELETE /api/v1/monthly-sheets/:id
 * @description Delete a monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}:
 *   delete:
 *     summary: Delete monthly sheet
 *     operationId: deleteMonthlySheetsById
 *     tags: [Monthly Sheets]
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
