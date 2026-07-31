import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, authorize, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { z } from 'zod';

const router: ExpressRouter = Router();

const CreateProjectSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  githubUrl: z.string().optional(),
  liveDemoUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: listProjects
 *     tags: [projects]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *           default: published
 *     responses:
 *       200:
 *         description: Paginated project list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;

    const query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('status', status || 'published');

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 20;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum - 1);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: count || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/slug/{slug}:
 *   get:
 *     summary: getProjectBySlug
 *     tags: [projects]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Project not found
 */
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', req.params.slug)
      .single();

    if (error || !data) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: getProjectByID
 *     tags: [projects]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: createANewProject
 *     tags: [projects]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectBody'
 *     responses:
 *       201:
 *         description: Project created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient role
 */
router.post(
  '/',
  authenticateToken,
  authorize('admin', 'editor'),
  async (req: AuthRequest, res, next) => {
    try {
      const data = CreateProjectSchema.parse(req.body);

      const { data: project, error } = await supabase
        .from('projects')
        .insert({ user_id: req.userId, ...data, status: 'draft' })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: updateAProject
 *     tags: [projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectBody'
 *     responses:
 *       200:
 *         description: Project updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       403:
 *         description: Not the project owner
 *       404:
 *         description: Project not found
 */
router.put(
  '/:id',
  authenticateToken,
  authorize('admin', 'editor'),
  async (req: AuthRequest, res, next) => {
    try {
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', req.params.id)
        .single();

      if (fetchError || !project) {
        throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      }

      if (project.user_id !== req.userId) {
        throw new AppError('Unauthorized', 403, 'FORBIDDEN');
      }

      const { data: updated, error } = await supabase
        .from('projects')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: deleteAProject
 *     tags: [projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Project deleted
 *       403:
 *         description: Not the project owner
 *       404:
 *         description: Project not found
 */
router.delete(
  '/:id',
  authenticateToken,
  authorize('admin', 'editor'),
  async (req: AuthRequest, res, next) => {
    try {
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', req.params.id)
        .single();

      if (fetchError || !project) {
        throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      }

      if (project.user_id !== req.userId) {
        throw new AppError('Unauthorized', 403, 'FORBIDDEN');
      }

      const { error } = await supabase.from('projects').delete().eq('id', req.params.id);

      if (error) throw error;

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}/publish:
 *   post:
 *     summary: publishAProject
 *     tags: [projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 */
router.post(
  '/:id/publish',
  authenticateToken,
  authorize('admin', 'editor'),
  async (req: AuthRequest, res, next) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', req.params.id);

      if (error) throw error;

      const { data: project } = await supabase
        .from('projects')
        .select()
        .eq('id', req.params.id)
        .single();

      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}/archive:
 *   post:
 *     summary: archiveAProject
 *     tags: [projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project archived
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 */
router.post(
  '/:id/archive',
  authenticateToken,
  authorize('admin', 'editor'),
  async (req: AuthRequest, res, next) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', req.params.id);

      if (error) throw error;

      const { data: project } = await supabase
        .from('projects')
        .select()
        .eq('id', req.params.id)
        .single();

      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
