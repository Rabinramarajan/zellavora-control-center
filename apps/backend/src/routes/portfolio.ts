import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router: ExpressRouter = Router();

// ============================================================================
// PROFILE
// ============================================================================

/**
 * @swagger
 * /portfolio/profile:
 *   get:
 *     summary: Get a user's profile
 *     tags: [Portfolio]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID whose profile to retrieve
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profile not found
 */
router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.query.userId as string;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /portfolio/profile:
 *   put:
 *     summary: Update the authenticated user's profile
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Profile'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/profile',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(req.body)
        .eq('user_id', req.userId)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// SKILLS
// ============================================================================

/**
 * @swagger
 * /portfolio/skills:
 *   get:
 *     summary: List skills for a user
 *     tags: [Portfolio]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID whose skills to retrieve
 *     responses:
 *       200:
 *         description: List of skills
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Skill'
 */
router.get('/skills', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /portfolio/skills:
 *   post:
 *     summary: Create a new skill
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Skill'
 *     responses:
 *       201:
 *         description: Skill created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Skill'
 *       401:
 *         description: Unauthorized
 */
router.post('/skills', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('skills')
      .insert({
        user_id: req.userId,
        ...req.body,
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
 * /portfolio/skills/{id}:
 *   put:
 *     summary: Update a skill
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Skill'
 *     responses:
 *       200:
 *         description: Skill updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Skill'
 *       401:
 *         description: Unauthorized
 */
router.put('/skills/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('skills')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
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
 * /portfolio/skills/{id}:
 *   delete:
 *     summary: Delete a skill
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill ID
 *     responses:
 *       204:
 *         description: Skill deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/skills/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { error } = await supabase
      .from('skills')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// EXPERIENCE
// ============================================================================

/**
 * @swagger
 * /portfolio/experience:
 *   get:
 *     summary: List experience entries for a user
 *     tags: [Portfolio]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID whose experience to retrieve
 *     responses:
 *       200:
 *         description: List of experience entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Experience'
 */
router.get('/experience', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    const { data, error } = await supabase
      .from('experience')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /portfolio/experience:
 *   post:
 *     summary: Create a new experience entry
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Experience'
 *     responses:
 *       201:
 *         description: Experience entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Experience'
 *       401:
 *         description: Unauthorized
 */
router.post('/experience', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('experience')
      .insert({
        user_id: req.userId,
        ...req.body,
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
 * /portfolio/experience/{id}:
 *   put:
 *     summary: Update an experience entry
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Experience entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Experience'
 *     responses:
 *       200:
 *         description: Experience entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Experience'
 *       401:
 *         description: Unauthorized
 */
router.put('/experience/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('experience')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
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
 * /portfolio/experience/{id}:
 *   delete:
 *     summary: Delete an experience entry
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Experience entry ID
 *     responses:
 *       204:
 *         description: Experience entry deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/experience/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { error } = await supabase
      .from('experience')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// EDUCATION
// ============================================================================

/**
 * @swagger
 * /portfolio/education:
 *   get:
 *     summary: List education entries for a user
 *     tags: [Portfolio]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID whose education to retrieve
 *     responses:
 *       200:
 *         description: List of education entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Education'
 */
router.get('/education', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    const { data, error } = await supabase
      .from('education')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /portfolio/education:
 *   post:
 *     summary: Create a new education entry
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Education'
 *     responses:
 *       201:
 *         description: Education entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Education'
 *       401:
 *         description: Unauthorized
 */
router.post('/education', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('education')
      .insert({
        user_id: req.userId,
        ...req.body,
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
 * /portfolio/education/{id}:
 *   put:
 *     summary: Update an education entry
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Education entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Education'
 *     responses:
 *       200:
 *         description: Education entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Education'
 *       401:
 *         description: Unauthorized
 */
router.put('/education/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('education')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
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
 * /portfolio/education/{id}:
 *   delete:
 *     summary: Delete an education entry
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Education entry ID
 *     responses:
 *       204:
 *         description: Education entry deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/education/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { error } = await supabase
      .from('education')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SERVICES
// ============================================================================

/**
 * @swagger
 * /portfolio/services:
 *   get:
 *     summary: List services for a user
 *     tags: [Portfolio]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID whose services to retrieve
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ServiceItem'
 */
router.get('/services', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /portfolio/services:
 *   post:
 *     summary: Create a new service
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceItem'
 *     responses:
 *       201:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceItem'
 *       401:
 *         description: Unauthorized
 */
router.post('/services', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .insert({
        user_id: req.userId,
        ...req.body,
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
 * /portfolio/services/{id}:
 *   put:
 *     summary: Update a service
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceItem'
 *     responses:
 *       200:
 *         description: Service updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceItem'
 *       401:
 *         description: Unauthorized
 */
router.put('/services/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
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
 * /portfolio/services/{id}:
 *   delete:
 *     summary: Delete a service
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     responses:
 *       204:
 *         description: Service deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/services/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// TESTIMONIALS
// ============================================================================

/**
 * @swagger
 * /portfolio/testimonials:
 *   get:
 *     summary: List testimonials for a user
 *     tags: [Portfolio]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID whose testimonials to retrieve
 *     responses:
 *       200:
 *         description: List of testimonials
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Testimonial'
 */
router.get('/testimonials', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /portfolio/testimonials:
 *   post:
 *     summary: Create a new testimonial
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Testimonial'
 *     responses:
 *       201:
 *         description: Testimonial created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Testimonial'
 *       401:
 *         description: Unauthorized
 */
router.post('/testimonials', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .insert({
        user_id: req.userId,
        ...req.body,
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
 * /portfolio/testimonials/{id}:
 *   put:
 *     summary: Update a testimonial
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Testimonial ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Testimonial'
 *     responses:
 *       200:
 *         description: Testimonial updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Testimonial'
 *       401:
 *         description: Unauthorized
 */
router.put('/testimonials/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
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
 * /portfolio/testimonials/{id}:
 *   delete:
 *     summary: Delete a testimonial
 *     tags: [Portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Testimonial ID
 *     responses:
 *       204:
 *         description: Testimonial deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/testimonials/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
