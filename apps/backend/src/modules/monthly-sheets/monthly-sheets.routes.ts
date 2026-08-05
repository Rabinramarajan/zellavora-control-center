import { Router } from 'express';
import { MonthlySheetsController } from './monthly-sheets.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
const controller = new MonthlySheetsController(
  // Service will be injected via dependency injection in production
  {} as any
);

router.use(authMiddleware);

/**
 * @route POST /api/v1/monthly-sheets
 * @description Create a new monthly sheet
 */
router.post('/', (req, res, next) => {
  controller.create(req as any, req.body).catch(next);
});

/**
 * @route GET /api/v1/monthly-sheets
 * @description List monthly sheets with filtering
 */
router.get('/', (req, res, next) => {
  controller.list(req as any, req.query).catch(next);
});

/**
 * @route GET /api/v1/monthly-sheets/:id
 * @description Get a specific monthly sheet
 */
router.get('/:id', (req, res, next) => {
  controller.getById(req as any, req.params.id).catch(next);
});

/**
 * @route PUT /api/v1/monthly-sheets/:id
 * @description Update a monthly sheet
 */
router.put('/:id', (req, res, next) => {
  controller.update(req as any, req.params.id, req.body).catch(next);
});

/**
 * @route POST /api/v1/monthly-sheets/:id/submit
 * @description Submit monthly sheet for approval
 */
router.post('/:id/submit', (req, res, next) => {
  controller.submit(req as any, req.params.id).catch(next);
});

/**
 * @route POST /api/v1/monthly-sheets/:id/approve
 * @description Approve or reject a monthly sheet
 */
router.post('/:id/approve', (req, res, next) => {
  controller.approve(req as any, req.params.id, req.body).catch(next);
});

/**
 * @route POST /api/v1/monthly-sheets/:id/mark-paid
 * @description Mark monthly sheet as paid
 */
router.post('/:id/mark-paid', (req, res, next) => {
  controller.markAsPaid(req as any, req.params.id, req.body).catch(next);
});

/**
 * @route DELETE /api/v1/monthly-sheets/:id
 * @description Delete a monthly sheet
 */
router.delete('/:id', (req, res, next) => {
  controller.delete(req as any, req.params.id).catch(next);
});

export default router;
