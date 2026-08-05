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
router.post('/', (req, res) => controller.create(req as any, res));

/**
 * @route GET /api/v1/monthly-sheets
 * @description List monthly sheets with filtering
 */
router.get('/', (req, res) => controller.list(req as any, res));

/**
 * @route GET /api/v1/monthly-sheets/:id
 * @description Get a specific monthly sheet
 */
router.get('/:id', (req, res) => controller.getById(req as any, res));

/**
 * @route PUT /api/v1/monthly-sheets/:id
 * @description Update a monthly sheet
 */
router.put('/:id', (req, res) => controller.update(req as any, res));

/**
 * @route POST /api/v1/monthly-sheets/:id/submit
 * @description Submit monthly sheet for approval
 */
router.post('/:id/submit', (req, res) => controller.submit(req as any, res));

/**
 * @route POST /api/v1/monthly-sheets/:id/approve
 * @description Approve or reject a monthly sheet
 */
router.post('/:id/approve', (req, res) => controller.approve(req as any, res));

/**
 * @route POST /api/v1/monthly-sheets/:id/mark-paid
 * @description Mark monthly sheet as paid
 */
router.post('/:id/mark-paid', (req, res) => controller.markAsPaid(req as any, res));

/**
 * @route DELETE /api/v1/monthly-sheets/:id
 * @description Delete a monthly sheet
 */
router.delete('/:id', (req, res) => controller.delete(req as any, res));

export default router;
