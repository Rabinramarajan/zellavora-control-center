import { Router, type Response } from 'express';
import type { ZodTypeAny, output } from 'zod';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf, type OrgContext } from '../../middleware/org-context';
import {
  AboutUpdateSchema,
  EducationCreateSchema,
  EducationUpdateSchema,
  ExperienceCreateSchema,
  ExperienceUpdateSchema,
  HeroUpdateSchema,
  ProfileUpdateSchema,
  ReorderSchema,
  ServiceCreateSchema,
  ServiceUpdateSchema,
  SkillCreateSchema,
  SkillUpdateSchema,
  TestimonialCreateSchema,
  TestimonialUpdateSchema,
  type ReorderDto,
} from './portfolio.dto';
import { PortfolioService } from './portfolio.service';

const router = Router();
const service = new PortfolioService();
const read = requirePermission('portfolio:read');
const manage = requirePermission('portfolio:manage');

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: portfolio
 *   description: The signed-in user's portfolio (profile, hero, about, skills, experience, education, services, testimonials) and its public read.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PortfolioProfile:
 *       type: object
 *       properties:
 *         isPublic: { type: boolean, description: 'When true, GET /api/v1/public/portfolios/{username} returns this portfolio' }
 *         displayName: { type: string, nullable: true, maxLength: 120 }
 *         headline: { type: string, nullable: true, maxLength: 160 }
 *         location: { type: string, nullable: true, maxLength: 120 }
 *         email: { type: string, nullable: true, format: email, maxLength: 254 }
 *         phone: { type: string, nullable: true, maxLength: 30 }
 *         website: { type: string, nullable: true, maxLength: 500 }
 *         github: { type: string, nullable: true, maxLength: 500 }
 *         linkedin: { type: string, nullable: true, maxLength: 500 }
 *         twitter: { type: string, nullable: true, maxLength: 500 }
 *         avatarUrl: { type: string, nullable: true, maxLength: 1000 }
 *         resumeUrl: { type: string, nullable: true, maxLength: 1000 }
 *         updatedAt: { type: string, format: date-time, nullable: true, readOnly: true }
 *     PortfolioHero:
 *       type: object
 *       properties:
 *         greeting: { type: string, nullable: true, maxLength: 80 }
 *         title: { type: string, nullable: true, maxLength: 160 }
 *         subtitle: { type: string, nullable: true, maxLength: 400 }
 *         primaryCtaLabel: { type: string, nullable: true, maxLength: 40 }
 *         primaryCtaUrl: { type: string, nullable: true, maxLength: 500, description: 'https://, mailto: or /relative path' }
 *         secondaryCtaLabel: { type: string, nullable: true, maxLength: 40 }
 *         secondaryCtaUrl: { type: string, nullable: true, maxLength: 500 }
 *         imageUrl: { type: string, nullable: true, maxLength: 1000 }
 *         updatedAt: { type: string, format: date-time, nullable: true, readOnly: true }
 *     PortfolioAbout:
 *       type: object
 *       properties:
 *         body: { type: string, nullable: true, maxLength: 10000 }
 *         imageUrl: { type: string, nullable: true, maxLength: 1000 }
 *         updatedAt: { type: string, format: date-time, nullable: true, readOnly: true }
 *     PortfolioSkill:
 *       type: object
 *       required: [name]
 *       properties:
 *         id: { type: string, format: uuid, readOnly: true }
 *         name: { type: string, maxLength: 60 }
 *         category: { type: string, nullable: true, maxLength: 60 }
 *         level: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *         sortOrder: { type: integer, readOnly: true }
 *         createdAt: { type: string, format: date-time, readOnly: true }
 *         updatedAt: { type: string, format: date-time, readOnly: true }
 *     PortfolioExperience:
 *       type: object
 *       required: [role, company, startDate]
 *       properties:
 *         id: { type: string, format: uuid, readOnly: true }
 *         role: { type: string, maxLength: 160 }
 *         company: { type: string, maxLength: 160 }
 *         location: { type: string, nullable: true, maxLength: 120 }
 *         startDate: { type: string, format: date, example: '2023-01-15' }
 *         endDate: { type: string, format: date, nullable: true, description: 'Must be on or after startDate; null while isCurrent is true' }
 *         isCurrent: { type: boolean, default: false }
 *         description: { type: string, nullable: true, maxLength: 4000 }
 *         sortOrder: { type: integer, readOnly: true }
 *         createdAt: { type: string, format: date-time, readOnly: true }
 *         updatedAt: { type: string, format: date-time, readOnly: true }
 *     PortfolioEducation:
 *       type: object
 *       required: [institution, degree, startDate]
 *       properties:
 *         id: { type: string, format: uuid, readOnly: true }
 *         institution: { type: string, maxLength: 160 }
 *         degree: { type: string, maxLength: 160 }
 *         field: { type: string, nullable: true, maxLength: 160 }
 *         grade: { type: string, nullable: true, maxLength: 60 }
 *         startDate: { type: string, format: date }
 *         endDate: { type: string, format: date, nullable: true }
 *         description: { type: string, nullable: true, maxLength: 2000 }
 *         sortOrder: { type: integer, readOnly: true }
 *         createdAt: { type: string, format: date-time, readOnly: true }
 *         updatedAt: { type: string, format: date-time, readOnly: true }
 *     PortfolioService:
 *       type: object
 *       required: [title]
 *       properties:
 *         id: { type: string, format: uuid, readOnly: true }
 *         title: { type: string, maxLength: 120 }
 *         description: { type: string, nullable: true, maxLength: 1000 }
 *         icon: { type: string, nullable: true, maxLength: 40, pattern: '^[a-z0-9-]+$', description: 'Lowercase icon key' }
 *         sortOrder: { type: integer, readOnly: true }
 *         createdAt: { type: string, format: date-time, readOnly: true }
 *         updatedAt: { type: string, format: date-time, readOnly: true }
 *     PortfolioTestimonial:
 *       type: object
 *       required: [authorName, quote]
 *       properties:
 *         id: { type: string, format: uuid, readOnly: true }
 *         authorName: { type: string, maxLength: 120 }
 *         authorRole: { type: string, nullable: true, maxLength: 160 }
 *         company: { type: string, nullable: true, maxLength: 160 }
 *         quote: { type: string, maxLength: 1000 }
 *         avatarUrl: { type: string, nullable: true, maxLength: 1000 }
 *         rating: { type: integer, nullable: true, minimum: 1, maximum: 5 }
 *         sortOrder: { type: integer, readOnly: true }
 *         createdAt: { type: string, format: date-time, readOnly: true }
 *         updatedAt: { type: string, format: date-time, readOnly: true }
 *     PortfolioReorder:
 *       type: object
 *       required: [ids]
 *       properties:
 *         ids:
 *           type: array
 *           maxItems: 100
 *           items: { type: string, format: uuid }
 *           description: Every live item id of this section, in the new display order
 */

/**
 * @swagger
 * /api/v1/portfolio/profile:
 *   get:
 *     summary: getPortfolioProfile
 *     operationId: getPortfolioProfile
 *     description: The Profile section. Returns empty values until the first save.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile section
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/PortfolioProfile' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     summary: updatePortfolioProfile
 *     operationId: putPortfolioProfile
 *     description: Partial update. Omitted fields are unchanged; a blank string or null clears a field.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioProfile' }
 *     responses:
 *       200:
 *         description: Updated profile section
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/profile',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.getProfile(orgContextOf(req)) });
  })
);

router.put(
  '/profile',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = ProfileUpdateSchema.parse(req.body);
    res.json({ success: true, data: await service.updateProfile(orgContextOf(req), dto) });
  })
);

/**
 * @swagger
 * /api/v1/portfolio/hero:
 *   get:
 *     summary: getPortfolioHero
 *     operationId: getPortfolioHero
 *     description: The Hero section.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Hero section
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     summary: updatePortfolioHero
 *     operationId: putPortfolioHero
 *     description: Partial update of the Hero section.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioHero' }
 *     responses:
 *       200:
 *         description: Updated hero section
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/hero',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.getHero(orgContextOf(req)) });
  })
);

router.put(
  '/hero',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = HeroUpdateSchema.parse(req.body);
    res.json({ success: true, data: await service.updateHero(orgContextOf(req), dto) });
  })
);

/**
 * @swagger
 * /api/v1/portfolio/about:
 *   get:
 *     summary: getPortfolioAbout
 *     operationId: getPortfolioAbout
 *     description: The About section.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: About section
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     summary: updatePortfolioAbout
 *     operationId: putPortfolioAbout
 *     description: Partial update of the About section.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioAbout' }
 *     responses:
 *       200:
 *         description: Updated about section
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get(
  '/about',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.getAbout(orgContextOf(req)) });
  })
);

router.put(
  '/about',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = AboutUpdateSchema.parse(req.body);
    res.json({ success: true, data: await service.updateAbout(orgContextOf(req), dto) });
  })
);

// ---------------------------------------------------------------------------
// Collections: skills, experiences, education, services, testimonials
// ---------------------------------------------------------------------------

interface CollectionHandlers<C extends ZodTypeAny, U extends ZodTypeAny, D> {
  list: (ctx: OrgContext) => Promise<D[]>;
  create: (ctx: OrgContext, dto: output<C>) => Promise<D>;
  update: (ctx: OrgContext, id: string, dto: output<U>) => Promise<D>;
  remove: (ctx: OrgContext, id: string) => Promise<void>;
  reorder: (ctx: OrgContext, dto: ReorderDto) => Promise<D[]>;
}

/**
 * Registers list, create, reorder, update and delete for one owner-scoped section.
 * `reorder` is registered before `:id` so the literal segment is never read as an id.
 */
function mountCollection<C extends ZodTypeAny, U extends ZodTypeAny, D>(
  path: string,
  schemas: { create: C; update: U },
  handlers: CollectionHandlers<C, U, D>
): void {
  router.get(
    `/${path}`,
    read,
    asyncHandler<AuthRequest>(async (req, res: Response) => {
      res.json({ success: true, data: await handlers.list(orgContextOf(req)) });
    })
  );

  router.post(
    `/${path}`,
    manage,
    asyncHandler<AuthRequest>(async (req, res: Response) => {
      const dto = schemas.create.parse(req.body);
      res.status(201).json({ success: true, data: await handlers.create(orgContextOf(req), dto) });
    })
  );

  router.put(
    `/${path}/reorder`,
    manage,
    asyncHandler<AuthRequest>(async (req, res: Response) => {
      const dto = ReorderSchema.parse(req.body);
      res.json({ success: true, data: await handlers.reorder(orgContextOf(req), dto) });
    })
  );

  router.put(
    `/${path}/:id`,
    manage,
    asyncHandler<AuthRequest>(async (req, res: Response) => {
      const dto = schemas.update.parse(req.body);
      res.json({
        success: true,
        data: await handlers.update(orgContextOf(req), String(req.params.id), dto),
      });
    })
  );

  router.delete(
    `/${path}/:id`,
    manage,
    asyncHandler<AuthRequest>(async (req, res: Response) => {
      await handlers.remove(orgContextOf(req), String(req.params.id));
      res.status(204).end();
    })
  );
}

/**
 * @swagger
 * /api/v1/portfolio/skills:
 *   get:
 *     summary: listPortfolioSkills
 *     operationId: getPortfolioSkills
 *     description: Live skills in display order.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Skills
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: createPortfolioSkill
 *     operationId: postPortfolioSkills
 *     description: Appends a skill. Up to 100 items per section.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioSkill' }
 *     responses:
 *       201:
 *         description: Created skill
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { $ref: '#/components/responses/LimitReached' }
 * /api/v1/portfolio/skills/reorder:
 *   put:
 *     summary: reorderPortfolioSkills
 *     operationId: putPortfolioSkillsReorder
 *     description: Sets the display order. The list must contain every live skill id exactly once.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioReorder' }
 *     responses:
 *       200:
 *         description: Skills in the new order
 *       400: { $ref: '#/components/responses/ValidationError' }
 * /api/v1/portfolio/skills/{id}:
 *   put:
 *     summary: updatePortfolioSkill
 *     operationId: putPortfolioSkillsById
 *     description: Partial update.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioSkill' }
 *     responses:
 *       200:
 *         description: Updated skill
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: deletePortfolioSkill
 *     operationId: deletePortfolioSkillsById
 *     description: Soft delete. The item disappears from every read.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204:
 *         description: Deleted
 *       404: { $ref: '#/components/responses/NotFound' }
 */
mountCollection(
  'skills',
  { create: SkillCreateSchema, update: SkillUpdateSchema },
  {
    list: (ctx) => service.listSkills(ctx),
    create: (ctx, dto) => service.createSkill(ctx, dto),
    update: (ctx, id, dto) => service.updateSkill(ctx, id, dto),
    remove: (ctx, id) => service.deleteSkill(ctx, id),
    reorder: (ctx, dto) => service.reorderSkills(ctx, dto),
  }
);

/**
 * @swagger
 * /api/v1/portfolio/experiences:
 *   get:
 *     summary: listPortfolioExperiences
 *     operationId: getPortfolioExperiences
 *     description: Live experience entries in display order.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Experience entries
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: createPortfolioExperience
 *     operationId: postPortfolioExperiences
 *     description: Dates are checked as a range. A current role may not have an end date.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioExperience' }
 *     responses:
 *       201:
 *         description: Created entry
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { $ref: '#/components/responses/LimitReached' }
 * /api/v1/portfolio/experiences/reorder:
 *   put:
 *     summary: reorderPortfolioExperiences
 *     operationId: putPortfolioExperiencesReorder
 *     description: Sets the display order. The list must contain every live entry id exactly once.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioReorder' }
 *     responses:
 *       200:
 *         description: Entries in the new order
 *       400: { $ref: '#/components/responses/ValidationError' }
 * /api/v1/portfolio/experiences/{id}:
 *   put:
 *     summary: updatePortfolioExperience
 *     operationId: putPortfolioExperiencesById
 *     description: Partial update. Dates are validated against the stored values for fields left out.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioExperience' }
 *     responses:
 *       200:
 *         description: Updated entry
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: deletePortfolioExperience
 *     operationId: deletePortfolioExperiencesById
 *     description: Soft delete.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204:
 *         description: Deleted
 *       404: { $ref: '#/components/responses/NotFound' }
 */
mountCollection(
  'experiences',
  { create: ExperienceCreateSchema, update: ExperienceUpdateSchema },
  {
    list: (ctx) => service.listExperiences(ctx),
    create: (ctx, dto) => service.createExperience(ctx, dto),
    update: (ctx, id, dto) => service.updateExperience(ctx, id, dto),
    remove: (ctx, id) => service.deleteExperience(ctx, id),
    reorder: (ctx, dto) => service.reorderExperiences(ctx, dto),
  }
);

/**
 * @swagger
 * /api/v1/portfolio/education:
 *   get:
 *     summary: listPortfolioEducation
 *     operationId: getPortfolioEducation
 *     description: Live education entries in display order.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Education entries
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: createPortfolioEducation
 *     operationId: postPortfolioEducation
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioEducation' }
 *     responses:
 *       201:
 *         description: Created entry
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { $ref: '#/components/responses/LimitReached' }
 * /api/v1/portfolio/education/reorder:
 *   put:
 *     summary: reorderPortfolioEducation
 *     operationId: putPortfolioEducationReorder
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioReorder' }
 *     responses:
 *       200:
 *         description: Entries in the new order
 *       400: { $ref: '#/components/responses/ValidationError' }
 * /api/v1/portfolio/education/{id}:
 *   put:
 *     summary: updatePortfolioEducation
 *     operationId: putPortfolioEducationById
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioEducation' }
 *     responses:
 *       200:
 *         description: Updated entry
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: deletePortfolioEducation
 *     operationId: deletePortfolioEducationById
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204:
 *         description: Deleted
 *       404: { $ref: '#/components/responses/NotFound' }
 */
mountCollection(
  'education',
  { create: EducationCreateSchema, update: EducationUpdateSchema },
  {
    list: (ctx) => service.listEducation(ctx),
    create: (ctx, dto) => service.createEducation(ctx, dto),
    update: (ctx, id, dto) => service.updateEducation(ctx, id, dto),
    remove: (ctx, id) => service.deleteEducation(ctx, id),
    reorder: (ctx, dto) => service.reorderEducation(ctx, dto),
  }
);

/**
 * @swagger
 * /api/v1/portfolio/services:
 *   get:
 *     summary: listPortfolioServices
 *     operationId: getPortfolioServices
 *     description: Live services in display order.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Services
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: createPortfolioService
 *     operationId: postPortfolioServices
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioService' }
 *     responses:
 *       201:
 *         description: Created service
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { $ref: '#/components/responses/LimitReached' }
 * /api/v1/portfolio/services/reorder:
 *   put:
 *     summary: reorderPortfolioServices
 *     operationId: putPortfolioServicesReorder
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioReorder' }
 *     responses:
 *       200:
 *         description: Services in the new order
 *       400: { $ref: '#/components/responses/ValidationError' }
 * /api/v1/portfolio/services/{id}:
 *   put:
 *     summary: updatePortfolioService
 *     operationId: putPortfolioServicesById
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioService' }
 *     responses:
 *       200:
 *         description: Updated service
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: deletePortfolioService
 *     operationId: deletePortfolioServicesById
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204:
 *         description: Deleted
 *       404: { $ref: '#/components/responses/NotFound' }
 */
mountCollection(
  'services',
  { create: ServiceCreateSchema, update: ServiceUpdateSchema },
  {
    list: (ctx) => service.listServices(ctx),
    create: (ctx, dto) => service.createService(ctx, dto),
    update: (ctx, id, dto) => service.updateService(ctx, id, dto),
    remove: (ctx, id) => service.deleteService(ctx, id),
    reorder: (ctx, dto) => service.reorderServices(ctx, dto),
  }
);

/**
 * @swagger
 * /api/v1/portfolio/testimonials:
 *   get:
 *     summary: listPortfolioTestimonials
 *     operationId: getPortfolioTestimonials
 *     description: Live testimonials in display order.
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Testimonials
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: createPortfolioTestimonial
 *     operationId: postPortfolioTestimonials
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioTestimonial' }
 *     responses:
 *       201:
 *         description: Created testimonial
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { $ref: '#/components/responses/LimitReached' }
 * /api/v1/portfolio/testimonials/reorder:
 *   put:
 *     summary: reorderPortfolioTestimonials
 *     operationId: putPortfolioTestimonialsReorder
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioReorder' }
 *     responses:
 *       200:
 *         description: Testimonials in the new order
 *       400: { $ref: '#/components/responses/ValidationError' }
 * /api/v1/portfolio/testimonials/{id}:
 *   put:
 *     summary: updatePortfolioTestimonial
 *     operationId: putPortfolioTestimonialsById
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PortfolioTestimonial' }
 *     responses:
 *       200:
 *         description: Updated testimonial
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: deletePortfolioTestimonial
 *     operationId: deletePortfolioTestimonialsById
 *     tags: [portfolio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204:
 *         description: Deleted
 *       404: { $ref: '#/components/responses/NotFound' }
 */
mountCollection(
  'testimonials',
  { create: TestimonialCreateSchema, update: TestimonialUpdateSchema },
  {
    list: (ctx) => service.listTestimonials(ctx),
    create: (ctx, dto) => service.createTestimonial(ctx, dto),
    update: (ctx, id, dto) => service.updateTestimonial(ctx, id, dto),
    remove: (ctx, id) => service.deleteTestimonial(ctx, id),
    reorder: (ctx, dto) => service.reorderTestimonials(ctx, dto),
  }
);

export default router;
