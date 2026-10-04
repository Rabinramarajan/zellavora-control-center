import { Router, type Response } from 'express';
import { mountSearchRoutes } from '../../infrastructure/search/search';
import { configurationSearch } from './configuration.search';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { ConfigurationService } from './configuration.service';
import {
  ConfigurationListQuerySchema,
  KeyParamSchema,
  UpsertConfigurationSchema,
} from './configuration.dto';

const router = Router();
const service = new ConfigurationService();

/**
 * @swagger
 * /api/v1/iam/configurations/search/criteria:
 *   get:
 *     summary: getIamConfigurationsSearchCriteria
 *     operationId: getIamConfigurationsSearchCriteria
 *     tags: [iamConfiguration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Default search request (filters, pageNumber, pageSize, orderByColumnName, ascending) }
 * /api/v1/iam/configurations/search:
 *   post:
 *     summary: searchIamConfigurations
 *     operationId: postIamConfigurationsSearch
 *     description: "Filtered, sorted, paginated configurations. orderByColumnName: key, category, updatedAt."
 *     tags: [iamConfiguration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: "{ pageNumber, pageSize, totalCount, items, msg }" }
 *       400: { description: Invalid criteria }
 */
mountSearchRoutes(router, configurationSearch(), [
  authenticate,
  requirePermission('settings:manage'),
]);

/**
 * @swagger
 * tags:
 *   name: iamConfiguration
 *   description: Organization-wide key/value configuration. Encrypted values are write-only.
 */

/**
 * @swagger
 * /api/v1/iam/configurations:
 *   get:
 *     summary: listConfigurations
 *     operationId: getIamConfigurations
 *     tags: [iamConfiguration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated entries (secrets masked) and the category facet
 *   put:
 *     summary: upsertConfiguration
 *     operationId: putIamConfigurations
 *     description: Create or update an entry by key. Omit `value` to keep an encrypted secret unchanged.
 *     tags: [iamConfiguration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved entry
 */
router.get(
  '/',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const query = ConfigurationListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(organizationId, query) });
  })
);

router.put(
  '/',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = UpsertConfigurationSchema.parse(req.body);
    res.json({ success: true, data: await service.upsert(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/configurations/{key}:
 *   delete:
 *     summary: deleteConfiguration
 *     operationId: deleteIamConfiguration
 *     tags: [iamConfiguration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  '/:key',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { key } = KeyParamSchema.parse(req.params);
    res.json({ success: true, data: await service.remove(organizationId, key, actorId) });
  })
);

export default router;
