import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { AppError } from '../../middleware/error';
import { orgContextOf } from '../../middleware/org-context';
import { ThemeService } from './theme.service';
import {
  CreateThemeSchema,
  DuplicateThemeSchema,
  ThemeListQuerySchema,
  UpdateThemeSchema,
} from './theme.dto';

const router = Router();
const service = new ThemeService();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: themes
 *   description: Organization theme library and the active branding applied to the app.
 */

/**
 * @swagger
 * /api/v1/themes/active:
 *   get:
 *     summary: getActiveTheme
 *     operationId: getThemesActive
 *     description: The caller's organization theme, or the built-in default when none is active.
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Theme to apply
 */
router.get(
  '/active',
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    if (!req.tenantId) throw new AppError('No organization selected', 403, 'TENANT_REQUIRED');
    res.json({ success: true, data: await service.active(req.tenantId) });
  })
);

/**
 * @swagger
 * /api/v1/themes:
 *   get:
 *     summary: listThemes
 *     operationId: getThemes
 *     description: Themes in the caller's organization; the active theme is listed first.
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: mode, schema: { type: string, enum: [light, dark] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: pageSize, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Paginated themes
 */
router.get(
  '/',
  requirePermission('themes:read'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const query = ThemeListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(orgContextOf(req), query) });
  })
);

/**
 * @swagger
 * /api/v1/themes:
 *   post:
 *     summary: createTheme
 *     operationId: postThemes
 *     description: Create a theme (inactive until activated).
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Theme created
 */
router.post(
  '/',
  requirePermission('themes:manage'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = CreateThemeSchema.parse(req.body);
    res.status(201).json({ success: true, data: await service.create(orgContextOf(req), dto) });
  })
);

/**
 * @swagger
 * /api/v1/themes/{id}:
 *   get:
 *     summary: getThemeById
 *     operationId: getThemesById
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Theme
 */
router.get(
  '/:id',
  requirePermission('themes:read'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.get(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/themes/{id}:
 *   patch:
 *     summary: updateTheme
 *     operationId: patchThemesById
 *     description: Update a theme. Send the loaded `version` to detect concurrent edits (409).
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Updated theme
 *       409:
 *         description: Name taken or edited by someone else
 */
router.patch(
  '/:id',
  requirePermission('themes:manage'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = UpdateThemeSchema.parse(req.body);
    res.json({
      success: true,
      data: await service.update(orgContextOf(req), req.params.id, dto),
    });
  })
);

/**
 * @swagger
 * /api/v1/themes/{id}:
 *   delete:
 *     summary: deleteTheme
 *     operationId: deleteThemesById
 *     description: Delete an inactive theme.
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  '/:id',
  requirePermission('themes:manage'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.remove(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/themes/{id}/activate:
 *   post:
 *     summary: activateTheme
 *     operationId: postThemesByIdActivate
 *     description: Make the theme the organization's active theme.
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Activated theme
 */
router.post(
  '/:id/activate',
  requirePermission('themes:manage'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.activate(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/themes/{id}/duplicate:
 *   post:
 *     summary: duplicateTheme
 *     operationId: postThemesByIdDuplicate
 *     description: Copy a theme under a new name.
 *     tags: [themes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: New theme
 */
router.post(
  '/:id/duplicate',
  requirePermission('themes:manage'),
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const { name } = DuplicateThemeSchema.parse(req.body);
    res.status(201).json({
      success: true,
      data: await service.duplicate(orgContextOf(req), req.params.id, name),
    });
  })
);

export default router;
