import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { BlogService } from './blog.service';
import {
  CreatePostSchema,
  PostListQuerySchema,
  PublishPostSchema,
  UpdatePostSchema,
} from './blog.dto';

const router = Router();
const service = new BlogService();
const read = requirePermission('blog:read');
const manage = requirePermission('blog:manage');

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: blog
 *   description: Blog / Insights posts for the caller's organization.
 */

/**
 * @swagger
 * /api/v1/blog/posts:
 *   get:
 *     summary: listBlogPosts
 *     operationId: getBlogPosts
 *     description: Search posts by title or slug, filtered by category, status and creation period.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, PUBLISHED, SCHEDULED, ARCHIVED] } }
 *       - { in: query, name: period, schema: { type: string, enum: ['7', '30', '90', '365'] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: pageSize, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Paginated posts
 */
router.get(
  '/posts',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const query = PostListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(orgContextOf(req), query) });
  })
);

/**
 * @swagger
 * /api/v1/blog/stats:
 *   get:
 *     summary: getBlogStats
 *     operationId: getBlogStats
 *     description: Post counts by status, total views and 30-day daily series.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blog statistics
 */
router.get(
  '/stats',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.stats(orgContextOf(req)) });
  })
);

/**
 * @swagger
 * /api/v1/blog/categories:
 *   get:
 *     summary: listBlogCategories
 *     operationId: getBlogCategories
 *     description: Categories in use, with post counts.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories
 */
router.get(
  '/categories',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.categories(orgContextOf(req)) });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts:
 *   post:
 *     summary: createBlogPost
 *     operationId: postBlogPosts
 *     description: Create a draft post. The slug is generated from the title when omitted.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Draft created
 */
router.post(
  '/posts',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = CreatePostSchema.parse(req.body);
    res.status(201).json({ success: true, data: await service.create(orgContextOf(req), dto) });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts/{id}:
 *   get:
 *     summary: getBlogPostById
 *     operationId: getBlogPostsById
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Post
 */
router.get(
  '/posts/:id',
  read,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.get(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts/{id}:
 *   patch:
 *     summary: updateBlogPost
 *     operationId: patchBlogPostsById
 *     description: Update a post. Send the loaded `version` to detect concurrent edits (409).
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Updated post
 */
router.patch(
  '/posts/:id',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const dto = UpdatePostSchema.parse(req.body);
    res.json({ success: true, data: await service.update(orgContextOf(req), req.params.id, dto) });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts/{id}:
 *   delete:
 *     summary: deleteBlogPost
 *     operationId: deleteBlogPostsById
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  '/posts/:id',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.remove(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts/{id}/publish:
 *   post:
 *     summary: publishBlogPost
 *     operationId: postBlogPostsByIdPublish
 *     description: Publish now, or schedule when `publishAt` is in the future.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Published or scheduled post
 */
router.post(
  '/posts/:id/publish',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const { publishAt } = PublishPostSchema.parse(req.body ?? {});
    res.json({
      success: true,
      data: await service.publish(orgContextOf(req), req.params.id, publishAt),
    });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts/{id}/unpublish:
 *   post:
 *     summary: unpublishBlogPost
 *     operationId: postBlogPostsByIdUnpublish
 *     description: Move a published or scheduled post back to draft.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Draft post
 */
router.post(
  '/posts/:id/unpublish',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res.json({ success: true, data: await service.unpublish(orgContextOf(req), req.params.id) });
  })
);

/**
 * @swagger
 * /api/v1/blog/posts/{id}/duplicate:
 *   post:
 *     summary: duplicateBlogPost
 *     operationId: postBlogPostsByIdDuplicate
 *     description: Copy a post as a new draft.
 *     tags: [blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: New draft
 */
router.post(
  '/posts/:id/duplicate',
  manage,
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    res
      .status(201)
      .json({ success: true, data: await service.duplicate(orgContextOf(req), req.params.id) });
  })
);

export default router;
