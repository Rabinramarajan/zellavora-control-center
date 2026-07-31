/**
 * RBAC REST controllers.
 *
 * Endpoints (all under /api/v1/rbac):
 *   GET    /permissions
 *   GET    /permissions/groups
 *   GET    /roles
 *   POST   /roles
 *   GET    /roles/:id
 *   PATCH  /roles/:id
 *   DELETE /roles/:id
 *   PUT    /roles/:id/permissions
 *   PUT    /roles/:id/inheritance
 *   POST   /roles/:id/clone
 *   GET    /users/:userId/roles
 *   POST   /users/:userId/roles
 *   DELETE /users/:userId/roles/:assignmentId
 *   GET    /me/policy
 *   POST   /check
 *   GET    /audit-logs
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/permission.middleware';
import type { PermissionEngine } from '../engine/permission-engine';
import type { RoleService, CreateRoleInput } from '../services/role.service';
import type { UserRoleService, AssignRoleInput } from '../services/user-role.service';
import type { AuditService } from '../services/audit.service';

// ---------- Zod schemas ----------

const CreateRole = z.object({
  key: z.string().regex(/^[a-z0-9_]{3,50}$/, 'lowercase, 3-50 chars'),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  level: z.number().int().min(0).max(100).default(0),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  inheritsFrom: z.array(z.string().uuid()).default([]),
  permissions: z
    .array(
      z.object({
        key: z.string().min(3).max(200),
        effect: z.enum(['allow', 'deny']).default('allow'),
      })
    )
    .default([]),
});

const UpdateRole = CreateRole.partial();

const PermissionsSet = z.array(
  z.object({
    key: z.string(),
    effect: z.enum(['allow', 'deny']),
  })
);

const InheritanceSet = z.array(z.string().uuid());

const AssignRole = z.object({
  roleId: z.string().uuid(),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().uuid().optional(),
  validUntil: z.string().datetime().optional(),
});

const CheckBody = z.object({
  checks: z.array(z.string()).min(1).max(100),
});

// ---------- Router factory ----------

export function buildRbacRouter(deps: {
  engine: PermissionEngine;
  roleService: RoleService;
  userRoleService: UserRoleService;
  audit: AuditService;
}): Router {
  const router = Router();
  const { engine, roleService, userRoleService, audit } = deps;
  const wrap =
    (h: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) =>
      h(req, res).catch(next);

  // ---------- Permissions ----------

  /**
   * @swagger
   * /api/v1/rbac/permissions:
   *   get:
   *     summary: listAllPermissions
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *         description: Filter by permission type
   *       - in: query
   *         name: groupId
   *         schema:
   *           type: string
   *         description: Filter by permission group ID
   *     responses:
   *       200:
   *         description: List of permissions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Permission'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:read
   */
  router.get(
    '/permissions',
    requirePermission('system:rbac:read'),
    wrap(async (req, res) => {
      const type = req.query.type as string | undefined;
      const groupId = req.query.groupId as string | undefined;
      const perms = await roleService.listPermissions({ type, groupId });
      res.json({ data: perms });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/permissions/groups:
   *   get:
   *     summary: listPermissionGroups
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of permission groups
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PermissionGroup'
   *       401:
   *         description: Unauthorized
   */
  router.get(
    '/permissions/groups',
    wrap(async (_req, res) => {
      const groups = await roleService.listPermissionGroups();
      res.json({ data: groups });
    })
  );

  // ---------- Roles ----------

  /**
   * @swagger
   * /api/v1/rbac/roles:
   *   get:
   *     summary: listAllRolesInTheTenant
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of roles
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Role'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:read
   */
  router.get(
    '/roles',
    requirePermission('system:rbac:read'),
    wrap(async (req, res) => {
      const orgId = req.auth!.tenantId;
      const roles = await roleService.list(orgId);
      res.json({ data: roles });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles/{id}:
   *   get:
   *     summary: getRoleDetail
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Role ID
   *     responses:
   *       200:
   *         description: Role detail
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Role'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:read
   *       404:
   *         description: Role not found
   */
  router.get(
    '/roles/:id',
    requirePermission('system:rbac:read'),
    wrap(async (req, res) => {
      const role = await roleService.getDetail(req.params.id);
      res.json({ data: role });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles:
   *   post:
   *     summary: createANewRole
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateRoleBody'
   *     responses:
   *       201:
   *         description: Role created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Role'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:write
   */
  router.post(
    '/roles',
    requirePermission('system:rbac:write'),
    wrap(async (req, res) => {
      const input = CreateRole.parse(req.body) as CreateRoleInput;
      const role = await roleService.create(req.auth!.tenantId, input, req.auth!.userId);
      res.status(201).json({ data: role });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles/{id}:
   *   patch:
   *     summary: updateARolePartial
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Role ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             allOf:
   *               - $ref: '#/components/schemas/CreateRoleBody'
   *             description: Partial role fields to update
   *     responses:
   *       200:
   *         description: Role updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Role'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:write
   */
  router.patch(
    '/roles/:id',
    requirePermission('system:rbac:write'),
    wrap(async (req, res) => {
      const input = UpdateRole.parse(req.body) as Partial<CreateRoleInput>;
      const role = await roleService.update(req.params.id, input, req.auth!.userId);
      res.json({ data: role });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles/{id}:
   *   delete:
   *     summary: deleteARole
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Role ID
   *     responses:
   *       200:
   *         description: Role deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:write
   */
  router.delete(
    '/roles/:id',
    requirePermission('system:rbac:write'),
    wrap(async (req, res) => {
      await roleService.delete(req.params.id, req.auth!.userId);
      res.json({ data: { ok: true } });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles/{id}/permissions:
   *   put:
   *     summary: setPermissionsOnARoleReplacesExistingSet
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Role ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               type: object
   *               required:
   *                 - key
   *                 - effect
   *               properties:
   *                 key:
   *                   type: string
   *                 effect:
   *                   type: string
   *                   enum: [allow, deny]
   *     responses:
   *       200:
   *         description: Permissions set successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:write
   */
  router.put(
    '/roles/:id/permissions',
    requirePermission('system:rbac:write'),
    wrap(async (req, res) => {
      const perms = PermissionsSet.parse(req.body) as Array<{
        key: string;
        effect: 'allow' | 'deny';
      }>;
      await roleService.setPermissions(req.params.id, perms, req.auth!.userId);
      res.json({ data: { ok: true } });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles/{id}/inheritance:
   *   put:
   *     summary: setParentRolesInheritanceForARole
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Role ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               type: string
   *               format: uuid
   *             description: Array of parent role UUIDs
   *     responses:
   *       200:
   *         description: Inheritance set successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:write
   */
  router.put(
    '/roles/:id/inheritance',
    requirePermission('system:rbac:write'),
    wrap(async (req, res) => {
      const parents = InheritanceSet.parse(req.body);
      await roleService.setInheritance(req.params.id, parents, req.auth!.userId);
      res.json({ data: { ok: true } });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/roles/{id}/clone:
   *   post:
   *     summary: cloneAnExistingRoleIntoANewRole
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Source role ID to clone
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - key
   *               - label
   *             properties:
   *               key:
   *                 type: string
   *                 pattern: '^[a-z0-9_]{3,50}$'
   *                 description: Unique key for the cloned role
   *               label:
   *                 type: string
   *                 maxLength: 200
   *                 description: Display label for the cloned role
   *     responses:
   *       201:
   *         description: Role cloned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/Role'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:write
   */
  router.post(
    '/roles/:id/clone',
    requirePermission('system:rbac:write'),
    wrap(async (req, res) => {
      const body = z
        .object({
          key: z.string().regex(/^[a-z0-9_]{3,50}$/),
          label: z.string().min(1).max(200),
        })
        .parse(req.body);
      const clone = await roleService.clone(
        req.params.id,
        body.key,
        body.label,
        req.auth!.tenantId,
        req.auth!.userId
      );
      res.status(201).json({ data: clone });
    })
  );

  // ---------- User assignments ----------

  /**
   * @swagger
   * /api/v1/rbac/users/{userId}/roles:
   *   get:
   *     summary: listRoleAssignmentsForAUser
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User ID
   *     responses:
   *       200:
   *         description: List of user role assignments
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/UserRoleAssignment'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:rbac:read
   */
  router.get(
    '/users/:userId/roles',
    requirePermission('system:rbac:read'),
    wrap(async (req, res) => {
      const orgId = req.auth!.tenantId;
      const list = await userRoleService.listForUser(req.params.userId, orgId);
      res.json({ data: list });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/users/{userId}/roles:
   *   post:
   *     summary: assignARoleToAUser
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UserRoleAssignment'
   *     responses:
   *       201:
   *         description: Role assigned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/UserRoleAssignment'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires users:role:assign
   */
  router.post(
    '/users/:userId/roles',
    requirePermission('users:role:assign'),
    wrap(async (req, res) => {
      const input = AssignRole.parse(req.body) as AssignRoleInput;
      const assignment = await userRoleService.assign(
        req.params.userId,
        input,
        req.auth!.tenantId,
        req.auth!.userId
      );
      res.status(201).json({ data: assignment });
    })
  );

  /**
   * @swagger
   * /api/v1/rbac/users/{userId}/roles/{assignmentId}:
   *   delete:
   *     summary: revokeARoleAssignmentFromAUser
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User ID
   *       - in: path
   *         name: assignmentId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Role assignment ID
   *     responses:
   *       200:
   *         description: Role assignment revoked successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires users:role:assign
   */
  router.delete(
    '/users/:userId/roles/:assignmentId',
    requirePermission('users:role:assign'),
    wrap(async (req, res) => {
      await userRoleService.revoke(req.params.assignmentId, req.auth!.userId, req.body?.reason);
      res.json({ data: { ok: true } });
    })
  );

  // ---------- Policy (current user) ----------

  /**
   * @swagger
   * /api/v1/rbac/me/policy:
   *   get:
   *     summary: getTheResolvedPermissionPolicyForTheAuthenticatedCaller
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Caller's resolved policy
   *         headers:
   *           X-Policy-Version:
   *             schema:
   *               type: string
   *             description: Current policy version
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/PolicyResult'
   *       401:
   *         description: Unauthorized
   */
  router.get(
    '/me/policy',
    wrap(async (req, res) => {
      const policy = await engine.resolve(req.auth!.userId, req.auth!.tenantId);
      res.setHeader('X-Policy-Version', String(policy.version));
      res.json({ data: policy });
    })
  );

  // ---------- Bulk check ----------

  /**
   * @swagger
   * /api/v1/rbac/check:
   *   post:
   *     summary: bulkcheckMultiplePermissionsForTheAuthenticatedCaller
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - checks
   *             properties:
   *               checks:
   *                 type: array
   *                 minItems: 1
   *                 maxItems: 100
   *                 items:
   *                   type: string
   *                 description: Array of permission keys to check
   *     responses:
   *       200:
   *         description: Bulk check results
   *         headers:
   *           X-Policy-Version:
   *             schema:
   *               type: string
   *             description: Current policy version
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     results:
   *                       type: object
   *                       additionalProperties:
   *                         type: boolean
   *                     version:
   *                       type: string
   *       401:
   *         description: Unauthorized
   */
  router.post(
    '/check',
    wrap(async (req, res) => {
      const { checks } = CheckBody.parse(req.body);
      const { results, version } = await engine.checkMany(
        req.auth!.userId,
        req.auth!.tenantId,
        checks
      );
      res.setHeader('X-Policy-Version', String(version));
      res.json({ data: { results, version } });
    })
  );

  // ---------- Audit ----------

  /**
   * @swagger
   * /api/v1/rbac/audit-logs:
   *   get:
   *     summary: searchTheRBACAuditLog
   *     tags: [rbac]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: actor
   *         schema:
   *           type: string
   *         description: Filter by actor user ID
   *       - in: query
   *         name: action
   *         schema:
   *           type: string
   *         description: Filter by action type
   *       - in: query
   *         name: from
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start of date range
   *       - in: query
   *         name: to
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End of date range
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Number of results per page
   *     responses:
   *       200:
   *         description: Paginated audit log results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AuditLog'
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 pageSize:
   *                   type: integer
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden — requires system:audit:read
   */
  router.get(
    '/audit-logs',
    requirePermission('system:audit:read'),
    wrap(async (req, res) => {
      const orgId = req.auth!.tenantId;
      const page = await audit.search(orgId, {
        actor: req.query.actor as string | undefined,
        action: req.query.action as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
      });
      res.json(page);
    })
  );

  return router;
}
