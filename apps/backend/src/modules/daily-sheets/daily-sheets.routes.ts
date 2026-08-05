import { Router } from 'express';
import { DailySheetsController } from './daily-sheets.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
const controller = new DailySheetsController(
  // Service will be injected via dependency injection in production
  {} as any
);

router.use(authMiddleware);

/**
 * @route POST /api/v1/daily-sheets
 * @description Create a new daily sheet
 */
router.post('/', (req, res, next) => {
  controller.create(req as any, req.body).catch(next);
});

/**
 * @route GET /api/v1/daily-sheets
 * @description List daily sheets with filtering
 */
router.get('/', (req, res, next) => {
  controller.list(req as any, req.query).catch(next);
});

/**
 * @route GET /api/v1/daily-sheets/:id
 * @description Get a specific daily sheet
 */
router.get('/:id', (req, res, next) => {
  controller.getById(req as any, req.params.id).catch(next);
});

/**
 * @route PUT /api/v1/daily-sheets/:id
 * @description Update a daily sheet
 */
router.put('/:id', (req, res, next) => {
  controller.update(req as any, req.params.id, req.body).catch(next);
});

/**
 * @route POST /api/v1/daily-sheets/:id/submit
 * @description Submit daily sheet for approval
 */
router.post('/:id/submit', (req, res, next) => {
  controller.submit(req as any, req.params.id).catch(next);
});

/**
 * @route POST /api/v1/daily-sheets/:id/approve
 * @description Approve or reject a daily sheet
 */
router.post('/:id/approve', (req, res, next) => {
  controller.approve(req as any, req.params.id, req.body).catch(next);
});

/**
 * @route DELETE /api/v1/daily-sheets/:id
 * @description Delete a daily sheet
 */
router.delete('/:id', (req, res, next) => {
  controller.delete(req as any, req.params.id).catch(next);
});

export default router;
