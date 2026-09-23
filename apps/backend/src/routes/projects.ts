import { Router, type Router as ExpressRouter } from 'express';
import { Prisma, type PortfolioProject } from '@prisma/client';
import { prisma } from '../infrastructure/prisma';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { z } from 'zod';

const router: ExpressRouter = Router();

const CreateProjectSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  content: z.string().optional(),
  category: z.string().optional(),
  coverImageUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  liveDemoUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

const isUuid = (value: string): boolean => z.string().uuid().safeParse(value).success;

const notFound = (): AppError => new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');

const toSlugConflict = (error: unknown): unknown =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    ? new AppError('Slug already in use', 409, 'SLUG_TAKEN')
    : error;

const requireTenant = (req: AuthRequest): string => {
  if (!req.tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return req.tenantId;
};

/** Load a live project belonging to the caller's organization, or 404. */
const findTenantProject = async (id: string, tenantId: string): Promise<PortfolioProject> => {
  if (!isUuid(id)) throw notFound();
  const project = await prisma.portfolioProject.findFirst({
    where: { id, organizationId: tenantId, deletedAt: null },
  });
  if (!project) throw notFound();
  return project;
};

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: listProjects
 *     operationId: getProjects
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

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 20;
    const where: Prisma.PortfolioProjectWhereInput = {
      status: (status as string) || 'published',
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      prisma.portfolioProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.portfolioProject.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
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
 *     operationId: getProjectsSlugBySlug
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
    const project = await prisma.portfolioProject.findFirst({
      where: { slug: req.params.slug, deletedAt: null },
    });
    if (!project) throw notFound();

    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: getProjectById
 *     operationId: getProjectsById
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
    if (!isUuid(req.params.id)) throw notFound();
    const project = await prisma.portfolioProject.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!project) throw notFound();

    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: createProject
 *     operationId: postProjects
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
 *         description: Insufficient permission
 *       409:
 *         description: Slug already in use
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('projects:create'),
  async (req: AuthRequest, res, next) => {
    try {
      const tenantId = requireTenant(req);
      const { title, slug, description, ...optional } = CreateProjectSchema.parse(req.body);

      const project = await prisma.portfolioProject.create({
        data: {
          ...optional,
          title,
          slug,
          description,
          organizationId: tenantId,
          status: 'draft',
          createdBy: req.userId,
          updatedBy: req.userId,
        },
      });

      res.status(201).json(project);
    } catch (error) {
      next(toSlugConflict(error));
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: updateProject
 *     operationId: putProjectsById
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
 *         description: Insufficient permission
 *       404:
 *         description: Project not found
 *       409:
 *         description: Slug already in use
 */
router.put(
  '/:id',
  authenticateToken,
  requirePermission('projects:write'),
  async (req: AuthRequest, res, next) => {
    try {
      const project = await findTenantProject(req.params.id, requireTenant(req));
      const data = UpdateProjectSchema.parse(req.body);

      const updated = await prisma.portfolioProject.update({
        where: { id: project.id },
        data: { ...data, updatedBy: req.userId },
      });

      res.json(updated);
    } catch (error) {
      next(toSlugConflict(error));
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: deleteProject
 *     operationId: deleteProjectsById
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
 *         description: Insufficient permission
 *       404:
 *         description: Project not found
 */
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('projects:delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const project = await findTenantProject(req.params.id, requireTenant(req));

      await prisma.portfolioProject.update({
        where: { id: project.id },
        data: { deletedAt: new Date(), updatedBy: req.userId },
      });

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
 *     summary: publishProject
 *     operationId: postProjectsByIdPublish
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
  requirePermission('projects:write'),
  async (req: AuthRequest, res, next) => {
    try {
      const project = await findTenantProject(req.params.id, requireTenant(req));

      const published = await prisma.portfolioProject.update({
        where: { id: project.id },
        data: { status: 'published', publishedAt: new Date(), updatedBy: req.userId },
      });

      res.json(published);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}/archive:
 *   post:
 *     summary: archiveProject
 *     operationId: postProjectsByIdArchive
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
  requirePermission('projects:write'),
  async (req: AuthRequest, res, next) => {
    try {
      const project = await findTenantProject(req.params.id, requireTenant(req));

      const archived = await prisma.portfolioProject.update({
        where: { id: project.id },
        data: { status: 'archived', updatedBy: req.userId },
      });

      res.json(archived);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
