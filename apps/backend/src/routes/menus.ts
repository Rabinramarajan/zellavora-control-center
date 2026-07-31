import { Router, Request, Response, NextFunction } from 'express';
import { MenuService, MenuNode, MenuTree } from '../services/menu.service';
import { authenticate, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role?: string;
  };
}

// Validation schemas
const getMenuTreeSchema = z.object({
  includeHidden: z.boolean().optional(),
  category: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

const createMenuSchema = z.object({
  key: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  route: z.string().optional(),
  externalUrl: z.string().optional(),
  parentId: z.string().uuid().optional(),
  orderIndex: z.number().int().default(0),
  category: z.string().optional(),
  featureFlag: z.string().optional(),
  requiredPermission: z.string().optional(),
  requiredPermissions: z.array(z.string()).optional(),
  requiresAllPermissions: z.boolean().optional(),
  visible: z.boolean().default(true),
  visibilityType: z.enum(['all', 'authenticated', 'role', 'custom']).default('all'),
  visibilityCondition: z.record(z.any()).optional(),
  badge: z
    .object({
      icon: z.string().optional(),
      value: z.union([z.number(), z.string()]).optional(),
      style: z.enum(['default', 'success', 'danger', 'warning', 'info']).default('default'),
      animated: z.boolean().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

const updateMenuSchema = createMenuSchema.partial();

const reorderMenuSchema = z.object({
  menuId: z.string().uuid(),
  newParentId: z.string().uuid().optional(),
  orderIndex: z.number().int(),
});

export function createMenuRoutes(menuService: MenuService): Router {
  const router = Router();

  /**
   * GET /api/v1/menus
   * Fetch complete menu tree with optional filtering
   */
  /**
   * @swagger
   * /api/v1/menus:
   *   get:
   *     summary: fetchCompleteMenuTreeForTheAuthenticatedUser
   *     tags: [menus]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: includeHidden
   *         schema:
   *           type: boolean
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *       - in: query
   *         name: forceRefresh
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Menu tree for the user
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/MenuItem'
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *       401:
   *         description: Unauthorized
   */
  router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        return res.status(403).json({ error: 'No organization context' });
      }

      const { includeHidden, category, forceRefresh } = getMenuTreeSchema.parse(req.query);

      const tree = await menuService.getMenuTree(req.user.organizationId, req.user.id, {
        includeHidden,
        category,
        forceRefresh,
      });

      // Set cache headers
      res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.set('ETag', `"${tree.timestamp.getTime()}"`);

      return res.json(tree);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/menus/:id
   * Get single menu item with full hierarchy
   */
  router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        return res.status(403).json({ error: 'No organization context' });
      }

      const menu = await menuService.getMenuById(
        req.params.id,
        req.user.organizationId,
        req.user.id
      );

      if (!menu) {
        return res.status(404).json({ error: 'Menu not found' });
      }

      res.set('Cache-Control', 'public, max-age=300');
      return res.json(menu);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/menus/:id/children
   * Get children of a menu item
   */
  router.get(
    '/:id/children',
    authenticate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const children = await menuService.getMenuChildren(
          req.params.id,
          req.user.organizationId,
          req.user.id
        );

        res.set('Cache-Control', 'public, max-age=300');
        return res.json({ items: children });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/menus/favorites
   * Get user's favorite menus
   */
  router.get(
    '/user/favorites',
    authenticate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const favorites = await menuService.getFavoriteMenus(req.user.organizationId, req.user.id);

        res.set('Cache-Control', 'private, max-age=300');
        return res.json({ items: favorites });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/menus/recent
   * Get user's recently accessed menus
   */
  router.get(
    '/user/recent',
    authenticate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
        const recent = await menuService.getRecentMenus(
          req.user.organizationId,
          req.user.id,
          limit
        );

        res.set('Cache-Control', 'private, max-age=300');
        return res.json({ items: recent });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/menus/categories
   * Get menu categories
   */
  router.get(
    '/categories',
    authenticate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const categories = await menuService.getCategories(req.user.organizationId);

        res.set('Cache-Control', 'public, max-age=3600');
        return res.json({ items: categories });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/menus
   * Create new menu
   */
  /**
   * @swagger
   * /api/v1/menus:
   *   post:
   *     summary: createANewMenuItemAdminowner
   *     tags: [menus]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MenuItem'
   *     responses:
   *       201:
   *         description: Menu item created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuItem'
   *       403:
   *         description: Insufficient role
   */
  router.post(
    '/',
    authenticate,
    requireRole('admin', 'owner'),
    validateRequest(createMenuSchema),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const newMenu = await menuService.createMenu(
          req.user.organizationId,
          req.user.id,
          req.body
        );

        return res.status(201).json(newMenu);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /api/v1/menus/:id
   * Update menu
   */
  router.put(
    '/:id',
    authenticate,
    requireRole('admin', 'owner'),
    validateRequest(updateMenuSchema),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const updatedMenu = await menuService.updateMenu(
          req.params.id,
          req.user.organizationId,
          req.user.id,
          req.body
        );

        return res.json(updatedMenu);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /api/v1/menus/:id
   * Delete (soft delete) menu
   */
  router.delete(
    '/:id',
    authenticate,
    requireRole('admin', 'owner'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        await menuService.deleteMenu(req.params.id, req.user.organizationId, req.user.id);

        return res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/menus/:id/favorite
   * Toggle favorite status
   */
  router.post(
    '/:id/favorite',
    authenticate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        await menuService.toggleFavorite(req.params.id, req.user.organizationId, req.user.id);

        return res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/menus/:id/access
   * Track menu access
   */
  router.post(
    '/:id/access',
    authenticate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        await menuService.trackMenuAccess(req.params.id, req.user.organizationId, req.user.id);

        return res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /api/v1/menus/:id/visibility
   * Toggle menu visibility
   */
  router.patch(
    '/:id/visibility',
    authenticate,
    requireRole('admin', 'owner'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const { visible } = z.object({ visible: z.boolean() }).parse(req.body);

        const updated = await menuService.updateMenu(
          req.params.id,
          req.user.organizationId,
          req.user.id,
          { visible }
        );

        return res.json(updated);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PATCH /api/v1/menus/:id/order
   * Reorder menu items
   */
  router.patch(
    '/:id/order',
    authenticate,
    requireRole('admin', 'owner'),
    validateRequest(reorderMenuSchema),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const { newParentId, orderIndex } = req.body;

        const updated = await menuService.updateMenu(
          req.params.id,
          req.user.organizationId,
          req.user.id,
          {
            parentId: newParentId,
            orderIndex,
          }
        );

        return res.json(updated);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/menus/rebuild-cache
   * Rebuild menu cache (admin only)
   */
  router.post(
    '/rebuild-cache',
    authenticate,
    requireRole('admin', 'owner'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        // Force refresh for current user
        await menuService.getMenuTree(req.user.organizationId, req.user.id, { forceRefresh: true });

        return res.json({ success: true, message: 'Cache rebuilt' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
