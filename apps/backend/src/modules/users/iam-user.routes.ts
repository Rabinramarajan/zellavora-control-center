import { Router, type NextFunction, type Request, type Response } from 'express';
import { mountSearchRoutes } from '../../infrastructure/search/search';
import { userSearch } from './iam-user.search';
import { IamUserController } from './iam-user.controller';
import { UserAdminController } from './user-admin.controller';
import { authenticate, requirePermission } from '../../middleware/auth';
import { AppError } from '../../middleware/error';

const router = Router();

/**
 * Users are read-only. Account and access changes (profile, status, roles, groups,
 * unlock, MFA reset, create/delete) must go through a User Request so every change
 * is requested, approved, provisioned and audited. Only emergency actions (lock,
 * revoke sessions) and messages (password-reset email, resend invitation) stay direct.
 */
const changeViaUserRequest = (_req: Request, _res: Response, next: NextFunction): void =>
  next(
    new AppError(
      'Changes to users go through User Requests. Raise a request from Request Change on the user.',
      409,
      'CHANGE_REQUIRES_REQUEST'
    )
  );
const controller = new IamUserController();
const admin = new UserAdminController();
const read = [authenticate, requirePermission('users:read')];
const manage = [authenticate, requirePermission('users:manage')];

/**
 * @swagger
 * tags:
 *   name: iamUsers
 *   description: IAM user directory, status and RBAC assignments.
 */

/**
 * @swagger
 * /api/v1/iam/users/search/criteria:
 *   get:
 *     summary: getIamUsersSearchCriteria
 *     operationId: getIamUsersSearchCriteria
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Default search request (filters, pageNumber, pageSize, orderByColumnName, ascending) }
 * /api/v1/iam/users/search:
 *   post:
 *     summary: searchIamUsers
 *     operationId: postIamUsersSearch
 *     description: "Filtered, sorted, paginated users. orderByColumnName: fullName, employeeCode, joiningDate, endDate, status."
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: "{ pageNumber, pageSize, totalCount, items, msg }" }
 *       400: { description: Invalid criteria }
 */
mountSearchRoutes(router, userSearch(), [authenticate, requirePermission('users:read')]);

/**
 * @swagger
 * /api/v1/iam/users:
 *   get:
 *     summary: listUsers
 *     operationId: getIamUsers
 *     description: Paginated, filterable list of users in the directory.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED] }
 *       - in: query
 *         name: roleId
 *         schema: { type: string }
 *       - in: query
 *         name: groupId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get('/', authenticate, requirePermission('users:read'), controller.list);

/**
 * @swagger
 * /api/v1/iam/users/stats:
 *   get:
 *     summary: getUserStats
 *     operationId: getIamUsersStats
 *     description: User counts in total and per lifecycle status.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ total, byStatus: { ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED } }"
 */
router.get('/stats', authenticate, requirePermission('users:read'), controller.stats);

/**
 * @swagger
 * /api/v1/iam/users/{id}:
 *   get:
 *     summary: getUserById
 *     operationId: getIamUsersById
 *     description: Full user detail including role and group assignments.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User detail
 */
router.get('/:id', authenticate, requirePermission('users:read'), controller.getById);

/**
 * @swagger
 * /api/v1/iam/users:
 *   post:
 *     summary: createUser
 *     operationId: postIamUsers
 *     description: Create a user (optionally as an invitation pending onboarding).
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName]
 *             properties:
 *               email: { type: string, format: email }
 *               username: { type: string, nullable: true }
 *               fullName: { type: string }
 *               firstName: { type: string, nullable: true }
 *               lastName: { type: string, nullable: true }
 *               mobile: { type: string, nullable: true }
 *               department: { type: string, nullable: true }
 *               jobTitle: { type: string, nullable: true }
 *               sendInvite: { type: boolean, default: true }
 *               roleIds:
 *                 type: array
 *                 items: { type: string }
 *               groupIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}:
 *   patch:
 *     summary: updateUser
 *     operationId: patchIamUsersById
 *     description: Update user profile metadata and status.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               firstName: { type: string, nullable: true }
 *               lastName: { type: string, nullable: true }
 *               mobile: { type: string, nullable: true }
 *               department: { type: string, nullable: true }
 *               jobTitle: { type: string, nullable: true }
 *               timezone: { type: string, nullable: true }
 *               language: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED] }
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch('/:id', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}/status:
 *   put:
 *     summary: setUserStatus
 *     operationId: putIamUsersByIdStatus
 *     description: Transition a user's lifecycle status.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED] }
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: User status updated
 */
router.put('/:id/status', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}/lock:
 *   post:
 *     summary: lockUser
 *     operationId: postIamUsersByIdLock
 *     description: Lock a user account.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: User locked
 */
router.post('/:id/lock', authenticate, requirePermission('users:manage'), controller.lock);

/**
 * @swagger
 * /api/v1/iam/users/{id}/unlock:
 *   post:
 *     summary: unlockUser
 *     operationId: postIamUsersByIdUnlock
 *     description: Unlock a user account.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User unlocked
 */
router.post('/:id/unlock', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}/roles:
 *   put:
 *     summary: setUserRoles
 *     operationId: putIamUsersByIdRoles
 *     description: Set a user's role assignments (replace or merge).
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode: { type: string, enum: [replace, merge], default: replace }
 *               roleIds:
 *                 type: array
 *                 items: { type: string }
 *               organizationId: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: User roles updated
 */
router.put('/:id/roles', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}/groups:
 *   put:
 *     summary: setUserGroups
 *     operationId: putIamUsersByIdGroups
 *     description: Set a user's group memberships (replace or merge).
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode: { type: string, enum: [replace, merge], default: replace }
 *               groupIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: User groups updated
 */
router.put('/:id/groups', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}:
 *   delete:
 *     summary: deleteUser
 *     operationId: deleteIamUsersById
 *     description: Soft-delete a user (the platform owner is protected).
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/:id', authenticate, changeViaUserRequest);

/**
 * @swagger
 * /api/v1/iam/users/{id}/profile:
 *   get:
 *     summary: getUserProfile
 *     operationId: getIamUsersByIdProfile
 *     description: >
 *       User Details header, overview and the personal, employee, contact, organization and
 *       security sections, plus the actions allowed for the account's current state.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: User profile }
 *   patch:
 *     summary: updateUserProfile
 *     operationId: patchIamUsersByIdProfile
 *     description: Update any of the personal, employee, contact and organization sections. Changes are audited.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 * /api/v1/iam/users/{id}/access:
 *   get:
 *     summary: getUserAccess
 *     operationId: getIamUsersByIdAccess
 *     description: Groups, roles with their assignment source (direct or group) and effective permissions.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Effective access }
 * /api/v1/iam/users/{id}/sessions:
 *   get:
 *     summary: listUserSessions
 *     operationId: getIamUsersByIdSessions
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Active sessions }
 *   delete:
 *     summary: revokeAllUserSessions
 *     operationId: deleteIamUsersByIdSessions
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Sessions revoked }
 * /api/v1/iam/users/{id}/{history}:
 *   get:
 *     summary: getUserHistory
 *     operationId: getIamUsersByIdHistory
 *     description: One of notes, requests, status-history, emails, audit (read-only).
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: history, required: true, schema: { type: string, enum: [notes, requests, status-history, emails, audit] } }
 *     responses:
 *       200: { description: History rows }
 * /api/v1/iam/users/{id}/{action}:
 *   post:
 *     summary: userSecurityAction
 *     operationId: postIamUsersByIdAction
 *     description: >
 *       password-reset, require-password-change, reset-mfa, resend-invitation, cancel-invitation.
 *       Each is only accepted when the account's state allows it, and is audited.
 *     tags: [iamUsers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: action, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 */
router.get('/:id/profile', ...read, admin.profile);
router.patch('/:id/profile', authenticate, changeViaUserRequest);
router.get('/:id/access', ...read, admin.access);
router.get('/:id/sessions', ...read, admin.sessions);
router.delete('/:id/sessions', ...manage, admin.revokeAllSessions);
router.delete('/:id/sessions/:sessionId', ...manage, admin.revokeSession);
router.get('/:id/notes', ...read, admin.notes);
router.post('/:id/notes', ...manage, admin.addNote);
router.get('/:id/requests', ...read, admin.requests);
router.get('/:id/status-history', ...read, admin.statusHistory);
router.get('/:id/emails', ...read, admin.emails);
router.get('/:id/audit', ...read, admin.audit);
router.post('/:id/password-reset', ...manage, admin.sendPasswordReset);
router.post('/:id/require-password-change', authenticate, changeViaUserRequest);
router.post('/:id/reset-mfa', authenticate, changeViaUserRequest);
router.post('/:id/resend-invitation', ...manage, admin.resendInvitation);
router.post('/:id/cancel-invitation', authenticate, changeViaUserRequest);

export default router;
