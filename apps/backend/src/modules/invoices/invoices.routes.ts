import { Router } from 'express';
import { asyncRoute } from '../daily-sheets/sheets.shared';
import { authGuard } from '../../middleware/auth';
import { InvoicesController } from './invoices.controller';

/**
 * Invoices are private to their owner: every query is scoped to the caller,
 * so signing in is the only gate.
 */
const router = Router();
const controller = new InvoicesController();

router.use(authGuard);

/**
 * @swagger
 * /api/v1/invoices/profile:
 *   get:
 *     summary: getInvoiceProfile
 *     description: The caller's seller, bank and terms defaults; the account number comes back masked.
 *     operationId: getInvoicesProfile
 *     tags: [invoices]
 *     responses:
 *       default:
 *         description: Operation response
 *   put:
 *     summary: upsertInvoiceProfile
 *     description: Create or replace the profile. Omit `bankAccountNumber` to keep the stored one.
 *     operationId: putInvoicesProfile
 *     tags: [invoices]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/profile',
  asyncRoute((req, res) => controller.getProfile(req, res))
);
router.put(
  '/profile',
  asyncRoute((req, res) => controller.upsertProfile(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/clients:
 *   get:
 *     summary: listInvoiceClients
 *     operationId: getInvoicesClients
 *     tags: [invoices]
 *     responses:
 *       default:
 *         description: Operation response
 *   post:
 *     summary: createInvoiceClient
 *     operationId: postInvoicesClients
 *     tags: [invoices]
 *     responses:
 *       default:
 *         description: Operation response
 * /api/v1/invoices/clients/{id}:
 *   put:
 *     summary: updateInvoiceClient
 *     operationId: putInvoicesClientsById
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 *   delete:
 *     summary: deleteInvoiceClient
 *     description: Soft delete; issued invoices keep their snapshot of the client.
 *     operationId: deleteInvoicesClientsById
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/clients',
  asyncRoute((req, res) => controller.listClients(req, res))
);
router.post(
  '/clients',
  asyncRoute((req, res) => controller.createClient(req, res))
);
router.put(
  '/clients/:id',
  asyncRoute((req, res) => controller.updateClient(req, res))
);
router.delete(
  '/clients/:id',
  asyncRoute((req, res) => controller.deleteClient(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/export/register:
 *   get:
 *     summary: exportInvoiceRegister
 *     description: CSV of the invoices matching the list filters.
 *     operationId: getInvoicesExportRegister
 *     tags: [invoices]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, ISSUED, PAID, CANCELLED] } }
 *       - { in: query, name: clientId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: text/csv attachment
 */
// Declared before `/:id` so "export" is not matched as an id.
router.get(
  '/export/register',
  asyncRoute((req, res) => controller.register(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/export/bulk:
 *   post:
 *     summary: exportInvoicesBulk
 *     description: ZIP of PDFs for up to 50 of the caller's invoices, `{ ids: [] }`.
 *     operationId: postInvoicesExportBulk
 *     tags: [invoices]
 *     responses:
 *       200:
 *         description: application/zip attachment
 */
router.post(
  '/export/bulk',
  asyncRoute((req, res) => controller.bulk(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/import:
 *   post:
 *     summary: importInvoice
 *     description: >
 *       Record a bill issued outside the system under its own number, as ISSUED
 *       or PAID. A FYxx-yy/NN number moves the counter past it. 409
 *       INVOICE_NUMBER_TAKEN when the number exists.
 *     operationId: postInvoicesImport
 *     tags: [invoices]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/import',
  asyncRoute((req, res) => controller.import(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/from-monthly-sheet/{sheetId}:
 *   post:
 *     summary: createInvoiceFromMonthlySheet
 *     description: Draft from an approved or paid month. One live invoice per month.
 *     operationId: postInvoicesFromMonthlySheetBySheetId
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: sheetId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(
  '/from-monthly-sheet/:sheetId',
  asyncRoute((req, res) => controller.fromMonthlySheet(req, res))
);

/**
 * @swagger
 * /api/v1/invoices:
 *   get:
 *     summary: listInvoices
 *     operationId: getInvoices
 *     tags: [invoices]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, ISSUED, PAID, CANCELLED] } }
 *       - { in: query, name: clientId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 200 } }
 *     responses:
 *       default:
 *         description: Operation response
 *   post:
 *     summary: createInvoice
 *     description: Create a draft. Totals are computed on the server.
 *     operationId: postInvoices
 *     tags: [invoices]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/',
  asyncRoute((req, res) => controller.list(req, res))
);
router.post(
  '/',
  asyncRoute((req, res) => controller.create(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/{id}:
 *   get:
 *     summary: getInvoiceById
 *     operationId: getInvoicesById
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 *   put:
 *     summary: updateInvoice
 *     description: Drafts only; anything else answers 409 INVOICE_LOCKED.
 *     operationId: putInvoicesById
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 *   delete:
 *     summary: deleteInvoice
 *     description: Soft delete; drafts and cancelled invoices only. A cancelled bill frees its number.
 *     operationId: deleteInvoicesById
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/:id',
  asyncRoute((req, res) => controller.get(req, res))
);
router.put(
  '/:id',
  asyncRoute((req, res) => controller.update(req, res))
);
router.delete(
  '/:id',
  asyncRoute((req, res) => controller.delete(req, res))
);

/**
 * @swagger
 * /api/v1/invoices/{id}/issue:
 *   post:
 *     summary: issueInvoice
 *     description: Assign the next financial-year number, snapshot seller, client and bank, and lock.
 *     operationId: postInvoicesByIdIssue
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 * /api/v1/invoices/{id}/mark-paid:
 *   post:
 *     summary: markInvoicePaid
 *     operationId: postInvoicesByIdMarkPaid
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 * /api/v1/invoices/{id}/cancel:
 *   post:
 *     summary: cancelInvoice
 *     description: Reason required; the bill number stays used.
 *     operationId: postInvoicesByIdCancel
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       default:
 *         description: Operation response
 * /api/v1/invoices/{id}/export:
 *   get:
 *     summary: exportInvoice
 *     description: html for preview and print, pdf and docx as attachments, json for the view-model. Drafts carry a DRAFT watermark.
 *     operationId: getInvoicesByIdExport
 *     tags: [invoices]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, required: true, schema: { type: string, enum: [html, pdf, docx, json] } }
 *     responses:
 *       200:
 *         description: The rendered invoice
 */
router.post(
  '/:id/issue',
  asyncRoute((req, res) => controller.issue(req, res))
);
router.post(
  '/:id/mark-paid',
  asyncRoute((req, res) => controller.markPaid(req, res))
);
router.post(
  '/:id/cancel',
  asyncRoute((req, res) => controller.cancel(req, res))
);
router.get(
  '/:id/export',
  asyncRoute((req, res) => controller.export(req, res))
);

export default router;
