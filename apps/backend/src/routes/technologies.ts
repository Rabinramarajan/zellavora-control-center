import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router: ExpressRouter = Router();

/**
 * @swagger
 * /api/v1/technologies:
 *   get:
 *     summary: Get all technologies
 *     tags: [Technologies]
 *     security: []
 *     responses:
 *       200:
 *         description: List of all technologies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Technology'
 */
router.get('/technologies', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('technologies').select('*').order('name');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/technologies:
 *   post:
 *     summary: Create a new technology
 *     tags: [Technologies]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Technology'
 *     responses:
 *       201:
 *         description: Technology created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Technology'
 */
router.post('/technologies', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase.from('technologies').insert(req.body).select().single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{projectId}/technologies:
 *   get:
 *     summary: Get technologies for a project
 *     tags: [Technologies]
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
 *         description: Technologies used in the project
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Technology'
 */
router.get('/projects/:projectId/technologies', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('project_technologies')
      .select('technology_id, technologies(*)')
      .eq('project_id', req.params.projectId);

    if (error) throw error;

    const technologies = (data || []).map((pt: any) => pt.technologies);

    res.json(technologies);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{projectId}/technologies:
 *   post:
 *     summary: Add a technology to a project
 *     tags: [Technologies]
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
 *             required: [technologyId]
 *             properties:
 *               technologyId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Technology added to project
 *       403:
 *         description: Not the project owner
 *       404:
 *         description: Project not found
 */
router.post('/projects/:projectId/technologies', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { technologyId } = req.body;

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
      .from('project_technologies')
      .insert({ project_id: req.params.projectId, technology_id: technologyId })
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
 * /api/v1/projects/{projectId}/technologies:
 *   put:
 *     summary: Bulk replace technologies for a project
 *     tags: [Technologies]
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
 *             required: [technologyIds]
 *             properties:
 *               technologyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Technologies updated
 *       403:
 *         description: Not the project owner
 */
router.put('/projects/:projectId/technologies', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { technologyIds } = req.body;

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

    await supabase.from('project_technologies').delete().eq('project_id', req.params.projectId);

    const newAssociations = technologyIds.map((techId: string) => ({
      project_id: req.params.projectId,
      technology_id: techId,
    }));

    const { data, error } = await supabase.from('project_technologies').insert(newAssociations).select();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{projectId}/technologies/{technologyId}:
 *   delete:
 *     summary: Remove a technology from a project
 *     tags: [Technologies]
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
 *         name: technologyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Technology removed from project
 *       403:
 *         description: Not the project owner
 */
router.delete('/projects/:projectId/technologies/:technologyId', authenticateToken, async (req: AuthRequest, res, next) => {
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
      .from('project_technologies')
      .delete()
      .eq('project_id', req.params.projectId)
      .eq('technology_id', req.params.technologyId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
