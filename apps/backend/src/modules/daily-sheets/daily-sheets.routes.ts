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
router.post('/', (req, res) => controller.create(req as any, res));

/**
 * @route GET /api/v1/daily-sheets
 * @description List daily sheets with filtering
 */
router.get('/', (req, res) => controller.list(req as any, res));

/**
 * @route GET /api/v1/daily-sheets/:id
 * @description Get a specific daily sheet
 */
router.get('/:id', (req, res) => controller.getById(req as any, res));

/**
 * @route PUT /api/v1/daily-sheets/:id
 * @description Update a daily sheet
 */
router.put('/:id', (req, res) => controller.update(req as any, res));

/**
 * @route POST /api/v1/daily-sheets/:id/submit
 * @description Submit daily sheet for approval
 */
router.post('/:id/submit', (req, res) => controller.submit(req as any, res));

/**
 * @route POST /api/v1/daily-sheets/:id/approve
 * @description Approve or reject a daily sheet
 */
router.post('/:id/approve', (req, res) => controller.approve(req as any, res));

/**
 * @route DELETE /api/v1/daily-sheets/:id
 * @description Delete a daily sheet
 */
router.delete('/:id', (req, res) => controller.delete(req as any, res));

export default router;
