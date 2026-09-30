import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentSchema,
  DepartmentListQuerySchema,
  DepartmentMembersSchema,
  IdParamSchema,
  MemberParamSchema,
  UpdateDepartmentSchema,
} from './departments.dto';

const router = Router();
const service = new DepartmentsService();

/**
 * @swagger
 * tags:
 *   name: iamDepartments
 *   description: Organization departments (hierarchical) and their members.
 */

/**
 * @swagger
 * /api/v1/iam/departments:
 *   get:
 *     summary: listDepartments
 *     operationId: getIamDepartments
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Paginated departments
 *   post:
 *     summary: createDepartment
 *     operationId: postIamDepartments
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created department
 */
router.get(
  '/',
  authenticate,
  requirePermission('users:read', 'users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const query = DepartmentListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(organizationId, query) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = CreateDepartmentSchema.parse(req.body);
    res
      .status(201)
      .json({ success: true, data: await service.create(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/departments/{id}:
 *   get:
 *     summary: getDepartment
 *     operationId: getIamDepartment
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department with members
 *   put:
 *     summary: updateDepartment
 *     operationId: putIamDepartment
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated department
 *   delete:
 *     summary: deleteDepartment
 *     operationId: deleteIamDepartment
 *     description: Soft-deletes the department and unassigns its members. Fails while it has sub-departments.
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('users:read', 'users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    res.json({ success: true, data: await service.get(organizationId, id) });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    const dto = UpdateDepartmentSchema.parse(req.body);
    res.json({ success: true, data: await service.update(organizationId, id, dto, actorId) });
  })
);

router.delete(
  '/:id',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    res.json({ success: true, data: await service.remove(organizationId, id, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/departments/{id}/members:
 *   post:
 *     summary: addDepartmentMembers
 *     operationId: postIamDepartmentMembers
 *     description: Moves the given organization members into this department.
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department with members
 * /api/v1/iam/departments/{id}/members/{userId}:
 *   delete:
 *     summary: removeDepartmentMember
 *     operationId: deleteIamDepartmentMember
 *     tags: [iamDepartments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department with members
 */
router.post(
  '/:id/members',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    const { userIds } = DepartmentMembersSchema.parse(req.body);
    res.json({
      success: true,
      data: await service.addMembers(organizationId, id, userIds, actorId),
    });
  })
);

router.delete(
  '/:id/members/:userId',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id, userId } = MemberParamSchema.parse(req.params);
    res.json({
      success: true,
      data: await service.removeMember(organizationId, id, userId, actorId),
    });
  })
);

export default router;
