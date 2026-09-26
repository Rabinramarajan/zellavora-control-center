import { Router } from 'express';
import { DailySheetsController } from './daily-sheets.controller';
import { asyncRoute } from './sheets.shared';
import { REVIEW_PERMISSION } from '../timesheets/timesheets.rules';
import { authGuard, requirePermission } from '../../middleware/auth';

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
 *     tags: [dailySheets]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/',
  asyncRoute((req, res) => controller.create(req, res))
);

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
 *     tags: [dailySheets]
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
 * /api/v1/daily-sheets/projects:
 *   get:
 *     summary: listDailySheetProjects
 *     operationId: getDailySheetsProjects
 *     description: >
 *       Suggestions for the free-text project field: the organization's active
 *       projects plus project names the caller has used before.
 *     tags: [dailySheets]
 *     responses:
 *       200:
 *         description: Project names, sorted
 */
// Declared before `/:id` so "projects" is not matched as an id.
router.get(
  '/projects',
  asyncRoute((req, res) => controller.projects(req, res))
);

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
 *     tags: [dailySheets]
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
 * @route PUT /api/v1/daily-sheets/:id
 * @description Update a daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}:
 *   put:
 *     summary: updateDailySheet
 *     operationId: putDailySheetsById
 *     tags: [dailySheets]
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
 * @route POST /api/v1/daily-sheets/:id/submit
 * @description Submit daily sheet for approval
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}/submit:
 *   post:
 *     summary: submitDailySheet
 *     operationId: postDailySheetsByIdSubmit
 *     tags: [dailySheets]
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
 * @route POST /api/v1/daily-sheets/:id/approve
 * @description Approve or reject a daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}/approve:
 *   post:
 *     summary: approveDailySheet
 *     operationId: postDailySheetsByIdApprove
 *     tags: [dailySheets]
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
 * @route DELETE /api/v1/daily-sheets/:id
 * @description Delete a daily sheet
 */
/**
 * @swagger
 * /api/v1/daily-sheets/{id}:
 *   delete:
 *     summary: deleteDailySheet
 *     operationId: deleteDailySheetsById
 *     tags: [dailySheets]
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
