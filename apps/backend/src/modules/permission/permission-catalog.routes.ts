import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { PermissionCatalogService } from './permission-catalog.service';
import {
  CreateIamPermissionSchema,
  CreatePermissionGroupSchema,
  IamPermissionListQuerySchema,
  IdParamSchema,
  UpdateIamPermissionSchema,
} from './permission.dto';

const router = Router();
const service = new PermissionCatalogService();

/**
 * @swagger
 * tags:
 *   name: iamPermissions
 *   description: The permission catalog that roles grant from.
 */

/**
 * @swagger
 * /api/v1/iam/permissions:
 *   get:
 *     summary: listPermissionCatalog
 *     operationId: getIamPermissions
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated permissions with usage counts and the resource facet
 *   post:
 *     summary: createPermission
 *     operationId: postIamPermissions
 *     description: Creates `resource:action`. Keys are immutable afterwards.
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created permission
 */
router.get(
  '/',
  authenticate,
  requirePermission('roles:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = IamPermissionListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(query) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission('roles:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = CreateIamPermissionSchema.parse(req.body);
    res
      .status(201)
      .json({ success: true, data: await service.create(dto, actorId, organizationId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/permissions/groups:
 *   get:
 *     summary: listPermissionGroups
 *     operationId: getIamPermissionGroups
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission groups
 *   post:
 *     summary: createPermissionGroup
 *     operationId: postIamPermissionGroups
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created group
 */
router.get(
  '/groups',
  authenticate,
  requirePermission('roles:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await service.listGroups() });
  })
);

router.post(
  '/groups',
  authenticate,
  requirePermission('roles:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = CreatePermissionGroupSchema.parse(req.body);
    res
      .status(201)
      .json({ success: true, data: await service.createGroup(dto, actorId, organizationId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/permissions/{id}:
 *   get:
 *     summary: getPermission
 *     operationId: getIamPermission
 *     description: Permission with the roles that grant or deny it.
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission detail
 *   put:
 *     summary: updatePermission
 *     operationId: putIamPermission
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated permission
 *   delete:
 *     summary: deletePermission
 *     operationId: deleteIamPermission
 *     description: Only unused, non-wildcard permissions can be deleted.
 *     tags: [iamPermissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('roles:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = IdParamSchema.parse(req.params);
    res.json({ success: true, data: await service.get(id) });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission('roles:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    const dto = UpdateIamPermissionSchema.parse(req.body);
    res.json({ success: true, data: await service.update(id, dto, actorId, organizationId) });
  })
);

router.delete(
  '/:id',
  authenticate,
  requirePermission('roles:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    res.json({ success: true, data: await service.remove(id, actorId, organizationId) });
  })
);

export default router;
