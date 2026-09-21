import { Router, RequestHandler, Response, NextFunction } from 'express';
import { authGuard, requirePermission, AuthRequest } from '../../middleware/auth';
import { TimesheetsController } from './timesheets.controller';

const router = Router();
const controller = new TimesheetsController();

/**
 * Express 4 does not forward a rejected promise to the error middleware, so
 * every async handler is wrapped. Without this an `AppError` thrown inside a
 * controller would hang the request instead of returning its status code.
 */
const handle =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res)).catch(next);
  };

router.use(authGuard);

/**
 * @swagger
 * components:
 *   schemas:
 *     TimesheetEntry:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         timesheetId: { type: string, format: uuid }
 *         entryDate: { type: string, format: date }
 *         dayOfWeek: { type: string, example: Monday }
 *         startTime: { type: string, nullable: true, example: "09:00" }
 *         endTime: { type: string, nullable: true, example: "17:30" }
 *         hours: { type: number, nullable: true, minimum: 0, maximum: 24 }
 *         status:
 *           type: string
 *           enum: [EMPTY, WORKING, EXTENDED, WEEKEND_WORK, LEAVE, HOLIDAY]
 *         notes: { type: string, nullable: true }
 *     Timesheet:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         organizationId: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         period: { type: string, example: "2026-08" }
 *         status:
 *           type: string
 *           enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
 *         totalHours: { type: number }
 *         submittedAt: { type: string, format: date-time, nullable: true }
 *         approvedAt: { type: string, format: date-time, nullable: true }
 *         rejectedAt: { type: string, format: date-time, nullable: true }
 *         rejectionReason: { type: string, nullable: true }
 *         entries:
 *           type: array
 *           items: { $ref: '#/components/schemas/TimesheetEntry' }
 *     TimesheetEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean }
 *         data: { $ref: '#/components/schemas/Timesheet' }
 */

/**
 * @swagger
 * /api/v1/timesheets:
 *   get:
 *     summary: Get or list timesheets
 *     operationId: getTimesheets
 *     description: >
 *       With `period`, returns that period's timesheet, creating a draft
 *       pre-filled with one entry per calendar day if none exists. Without
 *       `period`, lists timesheets. `employeeId` defaults to the caller, and
 *       results are always scoped to the organization on the access token.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, example: "2026-08" }
 *       - in: query
 *         name: employeeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SUBMITTED, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: A timesheet, or a list of them
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 */
router.get(
  '/',
  handle((req, res) =>
    req.query['period'] ? controller.getForPeriod(req, res) : controller.list(req, res)
  )
);

/**
 * @swagger
 * /api/v1/timesheets/summary:
 *   get:
 *     summary: Get timesheet year summary
 *     operationId: getTimesheetsSummary
 *     description: Yearly rollup of hours, leave days and approvals.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: employeeId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The yearly rollup
 */
// Declared before `/:id` so "summary" is not matched as an id.
router.get('/summary', handle((req, res) => controller.summary(req, res)));

/**
 * @swagger
 * /api/v1/timesheets/{id}:
 *   get:
 *     summary: Get timesheet by ID
 *     operationId: getTimesheetsById
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The timesheet with its entries
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 *       404:
 *         description: Not found in this organization
 */
router.get('/:id', handle((req, res) => controller.getById(req, res)));

/**
 * @swagger
 * /api/v1/timesheets/{id}/export:
 *   get:
 *     summary: Export timesheet
 *     operationId: getTimesheetsByIdExport
 *     description: >
 *       `json` for backup and integrations, `csv` for spreadsheets, `html`
 *       for a print-ready document the browser can save as PDF.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, csv, html], default: json }
 *     responses:
 *       200:
 *         description: The exported timesheet
 */
router.get('/:id/export', handle((req, res) => controller.export(req, res)));

/**
 * @swagger
 * /api/v1/timesheets/{id}/entries/bulk:
 *   post:
 *     summary: Bulk upsert timesheet entries
 *     operationId: postTimesheetsByIdEntriesBulk
 *     description: Upsert several entries at once, then recalculate the total.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entries]
 *             properties:
 *               entries:
 *                 type: array
 *                 maxItems: 31
 *                 items:
 *                   type: object
 *                   required: [date]
 *                   properties:
 *                     date: { type: string, format: date }
 *                     startTime: { type: string, nullable: true }
 *                     endTime: { type: string, nullable: true }
 *                     hours: { type: number, nullable: true, minimum: 0, maximum: 24 }
 *                     status:
 *                       type: string
 *                       enum: [EMPTY, WORKING, EXTENDED, WEEKEND_WORK, LEAVE, HOLIDAY]
 *                     notes: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: The updated timesheet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 *       409:
 *         description: The timesheet is locked for editing
 */
router.post('/:id/entries/bulk', handle((req, res) => controller.bulkUpsertEntries(req, res)));

/**
 * @swagger
 * /api/v1/timesheets/{id}/entries/{entryId}:
 *   patch:
 *     summary: Update timesheet entry
 *     operationId: patchTimesheetsByIdEntriesByEntryId
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime: { type: string, nullable: true }
 *               endTime: { type: string, nullable: true }
 *               hours: { type: number, nullable: true, minimum: 0, maximum: 24 }
 *               status:
 *                 type: string
 *                 enum: [EMPTY, WORKING, EXTENDED, WEEKEND_WORK, LEAVE, HOLIDAY]
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: The updated timesheet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 *       403:
 *         description: Only the owning employee may edit entries
 */
router.patch('/:id/entries/:entryId', handle((req, res) => controller.updateEntry(req, res)));

/**
 * @swagger
 * /api/v1/timesheets/{id}/submit:
 *   post:
 *     summary: Submit timesheet
 *     operationId: postTimesheetsByIdSubmit
 *     description: Employee submits the sheet for approval.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The submitted timesheet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 *       409:
 *         description: Not in a submittable state
 */
router.post('/:id/submit', handle((req, res) => controller.submit(req, res)));

/**
 * @swagger
 * /api/v1/timesheets/{id}/approve:
 *   post:
 *     summary: Approve timesheet
 *     operationId: postTimesheetsByIdApprove
 *     description: Requires the `timesheet:approve` permission.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The approved timesheet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 *       403:
 *         description: Missing the timesheet:approve permission
 */
router.post(
  '/:id/approve',
  requirePermission('timesheet:approve'),
  handle((req, res) => controller.approve(req, res))
);

/**
 * @swagger
 * /api/v1/timesheets/{id}/reject:
 *   post:
 *     summary: Reject timesheet
 *     operationId: postTimesheetsByIdReject
 *     description: >
 *       Rejects with a reason and reopens the sheet for editing. Requires the
 *       `timesheet:approve` permission.
 *     tags: [Timesheets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason: { type: string, minLength: 1 }
 *     responses:
 *       200:
 *         description: The rejected timesheet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TimesheetEnvelope' }
 */
router.post(
  '/:id/reject',
  requirePermission('timesheet:approve'),
  handle((req, res) => controller.reject(req, res))
);

export default router;
