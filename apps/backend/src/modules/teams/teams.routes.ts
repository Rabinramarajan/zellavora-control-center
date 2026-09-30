import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { TeamsService } from './teams.service';
import {
  CreateTeamSchema,
  IdParamSchema,
  MemberParamSchema,
  TeamListQuerySchema,
  TeamMembersSchema,
  UpdateTeamSchema,
} from './teams.dto';

const router = Router();
const service = new TeamsService();

/**
 * @swagger
 * tags:
 *   name: iamTeams
 *   description: Teams and their members.
 */

/**
 * @swagger
 * /api/v1/iam/teams:
 *   get:
 *     summary: listTeams
 *     operationId: getIamTeams
 *     tags: [iamTeams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated teams with a member preview
 *   post:
 *     summary: createTeam
 *     operationId: postIamTeams
 *     tags: [iamTeams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created team
 */
router.get(
  '/',
  authenticate,
  requirePermission('users:read', 'users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const query = TeamListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(organizationId, query) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = CreateTeamSchema.parse(req.body);
    res
      .status(201)
      .json({ success: true, data: await service.create(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/teams/{id}:
 *   get:
 *     summary: getTeam
 *     operationId: getIamTeam
 *     tags: [iamTeams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team with members
 *   put:
 *     summary: updateTeam
 *     operationId: putIamTeam
 *     tags: [iamTeams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated team
 *   delete:
 *     summary: deleteTeam
 *     operationId: deleteIamTeam
 *     tags: [iamTeams]
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
    const dto = UpdateTeamSchema.parse(req.body);
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
 * /api/v1/iam/teams/{id}/members:
 *   post:
 *     summary: addTeamMembers
 *     operationId: postIamTeamMembers
 *     tags: [iamTeams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team with members
 * /api/v1/iam/teams/{id}/members/{userId}:
 *   delete:
 *     summary: removeTeamMember
 *     operationId: deleteIamTeamMember
 *     tags: [iamTeams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team with members
 */
router.post(
  '/:id/members',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = IdParamSchema.parse(req.params);
    const { userIds } = TeamMembersSchema.parse(req.body);
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
