import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router: ExpressRouter = Router();

/**
 * @swagger
 * /api/v1/projects/{projectId}/gallery:
 *   get:
 *     summary: Get all gallery images for a project
 *     tags: [Gallery]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Gallery items ordered by index
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GalleryItem'
 */
router.get('/projects/:projectId/gallery', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('project_gallery')
      .select('*')
      .eq('project_id', req.params.projectId)
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{projectId}/gallery:
 *   post:
 *     summary: Upload a gallery image to a project
 *     tags: [Gallery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mediaUrl]
 *             properties:
 *               mediaUrl:
 *                 type: string
 *               caption:
 *                 type: string
 *     responses:
 *       201:
 *         description: Gallery item created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GalleryItem'
 *       403:
 *         description: Not the project owner
 *       404:
 *         description: Project not found
 */
router.post('/projects/:projectId/gallery', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { mediaUrl, caption } = req.body;

    if (!mediaUrl) {
      throw new AppError('mediaUrl is required', 400, 'MISSING_MEDIA_URL');
    }

    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', req.params.projectId)
      .single();

    if (projError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== req.userId) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const { data: lastItem } = await supabase
      .from('project_gallery')
      .select('order_index')
      .eq('project_id', req.params.projectId)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const nextIndex = (lastItem?.order_index || -1) + 1;

    const { data, error } = await supabase
      .from('project_gallery')
      .insert({
        project_id: req.params.projectId,
        media_url: mediaUrl,
        caption: caption || null,
        order_index: nextIndex,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{projectId}/gallery/{imageId}:
 *   put:
 *     summary: Update a gallery item
 *     tags: [Gallery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *               order_index:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Gallery item updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GalleryItem'
 *       403:
 *         description: Not the project owner
 */
router.put('/projects/:projectId/gallery/:imageId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', req.params.projectId)
      .single();

    if (projError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== req.userId) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const { data, error } = await supabase
      .from('project_gallery')
      .update(req.body)
      .eq('id', req.params.imageId)
      .eq('project_id', req.params.projectId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{projectId}/gallery/{imageId}:
 *   delete:
 *     summary: Delete a gallery item
 *     tags: [Gallery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Gallery item deleted
 *       403:
 *         description: Not the project owner
 */
router.delete('/projects/:projectId/gallery/:imageId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', req.params.projectId)
      .single();

    if (projError || !project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.user_id !== req.userId) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const { error } = await supabase
      .from('project_gallery')
      .delete()
      .eq('id', req.params.imageId)
      .eq('project_id', req.params.projectId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
