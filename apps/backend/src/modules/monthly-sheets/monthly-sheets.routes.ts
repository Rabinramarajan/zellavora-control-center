import { Router } from 'express';
import { MonthlySheetsController } from './monthly-sheets.controller';
import { asyncRoute } from '../daily-sheets/sheets.shared';
import { REVIEW_PERMISSION } from '../timesheets/timesheets.rules';
import { authGuard, requirePermission } from '../../middleware/auth';

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
 *     summary: createMonthlySheet
 *     operationId: postMonthlySheets
 *     tags: [monthlySheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/',
  asyncRoute((req, res) => controller.create(req, res))
);

/**
 * @route GET /api/v1/monthly-sheets
 * @description List monthly sheets with filtering
 */
/**
 * @swagger
 * /api/v1/monthly-sheets:
 *   get:
 *     summary: listMonthlySheets
 *     operationId: getMonthlySheets
 *     tags: [monthlySheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/',
  asyncRoute((req, res) => controller.list(req, res))
);

/**
 * @swagger
 * /api/v1/monthly-sheets/document:
 *   get:
 *     summary: getMonthlyTimesheetDocument
 *     operationId: getMonthlySheetsDocument
 *     description: >
 *       The printable timesheet for a month: one row per calendar day, summary,
 *       schedule notes and approvals. `userId` defaults to the caller; anyone
 *       else requires the `timesheet:approve` permission.
 *     tags: [monthlySheets]
 *     parameters:
 *       - { in: query, name: month, required: true, schema: { type: integer, minimum: 1, maximum: 12 } }
 *       - { in: query, name: year, required: true, schema: { type: integer } }
 *       - { in: query, name: userId, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: The timesheet document
 */
// Declared before `/:id` so "document" is not matched as an id.
router.get(
  '/document',
  asyncRoute((req, res) => controller.document(req, res))
);

/**
 * @route GET /api/v1/monthly-sheets/:id
 * @description Get a specific monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}:
 *   get:
 *     summary: getMonthlySheetById
 *     operationId: getMonthlySheetsById
 *     tags: [monthlySheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/:id',
  asyncRoute((req, res) => controller.getById(req, res))
);

/**
 * @route PUT /api/v1/monthly-sheets/:id
 * @description Update a monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}:
 *   put:
 *     summary: updateMonthlySheet
 *     operationId: putMonthlySheetsById
 *     tags: [monthlySheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put(
  '/:id',
  asyncRoute((req, res) => controller.update(req, res))
);

/**
 * @route POST /api/v1/monthly-sheets/:id/submit
 * @description Submit monthly sheet for approval
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}/submit:
 *   post:
 *     summary: submitMonthlySheet
 *     operationId: postMonthlySheetsByIdSubmit
 *     tags: [monthlySheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/:id/submit',
  asyncRoute((req, res) => controller.submit(req, res))
);

/**
 * @route POST /api/v1/monthly-sheets/:id/approve
 * @description Approve or reject a monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}/approve:
 *   post:
 *     summary: approveMonthlySheet
 *     operationId: postMonthlySheetsByIdApprove
 *     tags: [monthlySheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/:id/approve',
  requirePermission(REVIEW_PERMISSION),
  asyncRoute((req, res) => controller.approve(req, res))
);

/**
 * @route POST /api/v1/monthly-sheets/:id/mark-paid
 * @description Mark monthly sheet as paid
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}/mark-paid:
 *   post:
 *     summary: markMonthlySheetAsPaid
 *     operationId: postMonthlySheetsByIdMarkPaid
 *     tags: [monthlySheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/:id/mark-paid',
  requirePermission(REVIEW_PERMISSION),
  asyncRoute((req, res) => controller.markAsPaid(req, res))
);

/**
 * @route DELETE /api/v1/monthly-sheets/:id
 * @description Delete a monthly sheet
 */
/**
 * @swagger
 * /api/v1/monthly-sheets/{id}:
 *   delete:
 *     summary: deleteMonthlySheet
 *     operationId: deleteMonthlySheetsById
 *     tags: [monthlySheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.delete(
  '/:id',
  asyncRoute((req, res) => controller.delete(req, res))
);

export default router;
