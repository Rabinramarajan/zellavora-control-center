import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { CmsService } from './cms.service';
import {
  CreatePageSchema,
  PageListQuerySchema,
  SaveBuilderSchema,
  SchedulePageSchema,
  SlugCheckSchema,
  UpdatePageSchema,
} from './cms.dto';

const router = Router();
const service = new CmsService();
const read = requirePermission('cms:read');
const manage = requirePermission('cms:manage');

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: cms
 *   description: CMS page builder — manage pages and their content sections.
 */

/**
 * @swagger
 * /api/v1/cms/pages/stats:
 *   get:
 *     summary: getCmsPageStats
 *     operationId: getCmsPagesStats
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Page counts by status
 */
router.get(
  '/pages/stats',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.stats(orgContextOf(req)) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/slug-check:
 *   get:
 *     summary: checkCmsSlug
 *     operationId: getCmsPagesSlugCheck
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: slug, required: true, schema: { type: string } }
 *       - { in: query, name: excludeId, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Slug availability
 */
router.get(
  '/pages/slug-check',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const { slug, excludeId } = SlugCheckSchema.parse(req.query);
    res.json({ success: true, data: await service.checkSlug(orgContextOf(req), slug, excludeId) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages:
 *   get:
 *     summary: listCmsPages
 *     operationId: getCmsPages
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: pageSize, schema: { type: integer } }
 *       - { in: query, name: sortBy, schema: { type: string } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc] } }
 *     responses:
 *       200:
 *         description: Paginated CMS pages
 */
router.get(
  '/pages',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const query = PageListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(orgContextOf(req), query) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages:
 *   post:
 *     summary: createCmsPage
 *     operationId: postCmsPages
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Draft page created
 */
router.post(
  '/pages',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = CreatePageSchema.parse(req.body);
    res.status(201).json({ success: true, data: await service.create(orgContextOf(req), dto) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}:
 *   get:
 *     summary: getCmsPageById
 *     operationId: getCmsPageById
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: CMS page with sections
 */
router.get(
  '/pages/:id',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.get(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}:
 *   patch:
 *     summary: updateCmsPage
 *     operationId: patchCmsPageById
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Updated page
 */
router.patch(
  '/pages/:id',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = UpdatePageSchema.parse(req.body);
    res.json({ success: true, data: await service.update(orgContextOf(req), req.params.id, dto) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}:
 *   delete:
 *     summary: deleteCmsPage
 *     operationId: deleteCmsPageById
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  '/pages/:id',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.remove(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/builder:
 *   get:
 *     summary: getCmsPageBuilder
 *     operationId: getCmsPageBuilderById
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Full page for builder
 */
router.get(
  '/pages/:id/builder',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.get(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/builder:
 *   put:
 *     summary: saveCmsPageBuilder
 *     operationId: putCmsPageBuilderById
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Saved page
 */
router.put(
  '/pages/:id/builder',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = SaveBuilderSchema.parse(req.body);
    res.json({
      success: true,
      data: await service.saveBuilder(orgContextOf(req), req.params.id, dto),
    });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/publish:
 *   post:
 *     summary: publishCmsPage
 *     operationId: postCmsPagePublish
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Published page
 */
router.post(
  '/pages/:id/publish',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.publish(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/unpublish:
 *   post:
 *     summary: unpublishCmsPage
 *     operationId: postCmsPageUnpublish
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Draft page
 */
router.post(
  '/pages/:id/unpublish',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.unpublish(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/schedule:
 *   post:
 *     summary: scheduleCmsPage
 *     operationId: postCmsPageSchedule
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Scheduled page
 */
router.post(
  '/pages/:id/schedule',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const { scheduledAt } = SchedulePageSchema.parse(req.body);
    res.json({
      success: true,
      data: await service.schedule(orgContextOf(req), req.params.id, scheduledAt),
    });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/duplicate:
 *   post:
 *     summary: duplicateCmsPage
 *     operationId: postCmsPageDuplicate
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: New draft copy
 */
router.post(
  '/pages/:id/duplicate',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res
      .status(201)
      .json({ success: true, data: await service.duplicate(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/versions:
 *   get:
 *     summary: getCmsPageVersions
 *     operationId: getCmsPageVersions
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Revision list
 */
router.get(
  '/pages/:id/versions',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({
      success: true,
      data: await service.getVersions(orgContextOf(req), req.params.id),
    });
  })
);

/**
 * @swagger
 * /api/v1/cms/pages/{id}/versions/{versionId}/restore:
 *   post:
 *     summary: restoreCmsPageVersion
 *     operationId: postCmsPageVersionRestore
 *     tags: [cms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: versionId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Restored page
 */
router.post(
  '/pages/:id/versions/:versionId/restore',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({
      success: true,
      data: await service.restoreVersion(
        orgContextOf(req),
        req.params.id,
        req.params.versionId
      ),
    });
  })
);

export default router;
