import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { UserRequestController } from './user-request.controller';

const router = Router();
const controller = new UserRequestController();

// Anyone who can see the directory may raise a request; approval authority is
// enforced per step in the service (named approver or users:manage).
const read = [authenticate, requirePermission('users:read')];

/**
 * @swagger
 * tags:
 *   name: iamUserRequests
 *   description: IAM user request workflow — create, approve, provision and audit user/access changes.
 */

/**
 * @swagger
 * /api/v1/iam/user-requests:
 *   get:
 *     summary: listUserRequests
 *     operationId: getIamUserRequests
 *     description: Search user requests. Multi-value filters accept comma-separated values.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: refNo, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string }, description: "NEW_USER,UPDATE_USER,..." }
 *       - { in: query, name: name, schema: { type: string } }
 *       - { in: query, name: employeeCode, schema: { type: string } }
 *       - { in: query, name: email, schema: { type: string } }
 *       - { in: query, name: requestedById, schema: { type: string, format: uuid } }
 *       - { in: query, name: branchId, schema: { type: string } }
 *       - { in: query, name: departmentId, schema: { type: string } }
 *       - { in: query, name: teamId, schema: { type: string } }
 *       - { in: query, name: groupId, schema: { type: string } }
 *       - { in: query, name: roleId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paginated requests with per-status counts }
 *   post:
 *     summary: createUserRequest
 *     operationId: postIamUserRequests
 *     description: Create a request as a draft, or submit it immediately with `submit: true`.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, justification]
 *             properties:
 *               type: { type: string }
 *               targetUserId: { type: string, format: uuid, nullable: true }
 *               priority: { type: string, enum: [LOW, NORMAL, HIGH, URGENT] }
 *               justification: { type: string }
 *               effectiveFrom: { type: string, format: date-time, nullable: true }
 *               effectiveUntil: { type: string, format: date-time, nullable: true }
 *               payload: { type: object }
 *               submit: { type: boolean }
 *     responses:
 *       201: { description: Request created }
 */
router.get('/', ...read, controller.list);
router.post('/', ...read, controller.create);

/**
 * @swagger
 * /api/v1/iam/user-requests/lookups:
 *   get:
 *     summary: getUserRequestLookups
 *     operationId: getIamUserRequestsLookups
 *     description: Branches, departments, teams, groups and roles for request forms and filters.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lookup lists }
 */
router.get('/lookups', ...read, controller.lookups);

/**
 * @swagger
 * /api/v1/iam/user-requests/access-preview:
 *   post:
 *     summary: previewUserRequestAccess
 *     operationId: postIamUserRequestsAccessPreview
 *     description: Effective access preview (current vs requested) for an unsaved request.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Comparison rows and calculated permissions }
 */
router.post('/access-preview', ...read, controller.preview);

/**
 * @swagger
 * /api/v1/iam/user-requests/{id}:
 *   get:
 *     summary: getUserRequest
 *     operationId: getIamUserRequestsById
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Request detail with approvals, history, notes and emails }
 *   patch:
 *     summary: updateUserRequest
 *     operationId: patchIamUserRequestsById
 *     description: Edit a draft or sent-back request.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Request updated }
 */
router.get('/:id', ...read, controller.getById);
router.patch('/:id', ...read, controller.update);

/**
 * @swagger
 * /api/v1/iam/user-requests/{id}/access:
 *   get:
 *     summary: getUserRequestAccess
 *     operationId: getIamUserRequestsByIdAccess
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Current vs requested access }
 * /api/v1/iam/user-requests/{id}/audit:
 *   get:
 *     summary: getUserRequestAudit
 *     operationId: getIamUserRequestsByIdAudit
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Read-only audit trail }
 */
router.get('/:id/access', ...read, controller.requestPreview);
router.get('/:id/audit', ...read, controller.audit);

/**
 * @swagger
 * /api/v1/iam/user-requests/{id}/{action}:
 *   post:
 *     summary: userRequestAction
 *     operationId: postIamUserRequestsByIdAction
 *     description: >
 *       Workflow transitions: submit, approve, reject, send-back, cancel, retry-provisioning.
 *       reject and send-back require `comments`.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: action, required: true, schema: { type: string, enum: [submit, approve, reject, send-back, cancel, retry-provisioning] } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments: { type: string }
 *     responses:
 *       200: { description: Updated request detail }
 */
router.post('/:id/submit', ...read, controller.submit);
router.post('/:id/approve', ...read, controller.approve);
router.post('/:id/reject', ...read, controller.reject);
router.post('/:id/send-back', ...read, controller.sendBack);
router.post('/:id/cancel', ...read, controller.cancel);
router.post(
  '/:id/retry-provisioning',
  authenticate,
  requirePermission('users:manage'),
  controller.retryProvisioning
);

/**
 * @swagger
 * /api/v1/iam/user-requests/{id}/notes:
 *   post:
 *     summary: addUserRequestNote
 *     operationId: postIamUserRequestsByIdNotes
 *     description: Append a note. Notes are immutable once written.
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Note added }
 * /api/v1/iam/user-requests/{id}/emails/{emailId}/retry:
 *   post:
 *     summary: retryUserRequestEmail
 *     operationId: postIamUserRequestsByIdEmailsByEmailIdRetry
 *     tags: [iamUserRequests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: emailId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Email re-sent }
 */
router.post('/:id/notes', ...read, controller.addNote);
router.post(
  '/:id/emails/:emailId/retry',
  authenticate,
  requirePermission('users:manage'),
  controller.retryEmail
);

export default router;
