/**
 * Per-organization self-registration settings — mounted at
 * /api/v1/settings/registration.
 *
 * Every route requires `settings:manage`: turning self-registration on opens an
 * organization to public sign-up and puts it in the public picker, so this is a
 * security control rather than a preference.
 */
import { Router, type Response, type Router as ExpressRouter } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { AppError } from '../../middleware/error';
import { RegistrationSettingsService } from './registration-settings.service';
import { RegistrationSettingsSchema } from './registration-settings.dto';

const router: ExpressRouter = Router();
const service = new RegistrationSettingsService();

/** These settings are always the caller's own organization; there is no id in the path. */
const callerOrg = (req: AuthRequest): string => {
  const organizationId = req.tenantId;
  if (!organizationId) {
    throw new AppError('No organization in context', 400, 'ORGANIZATION_REQUIRED');
  }
  return organizationId;
};

/**
 * @swagger
 * tags:
 *   name: settingsRegistration
 *   description: Per-organization self-registration configuration.
 */

/**
 * @swagger
 * /api/v1/settings/registration:
 *   get:
 *     summary: getRegistrationSettings
 *     operationId: getSettingsRegistration
 *     description: >
 *       This organization's self-registration settings, plus the effective
 *       state — an organization can have the switch on and still be closed
 *       because the deployment-wide ALLOW_SELF_REGISTRATION flag is off.
 *     tags: [settingsRegistration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current registration configuration
 *       403:
 *         description: Forbidden - requires settings:manage
 */
router.get(
  '/',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await service.get(callerOrg(req)) });
  })
);

/**
 * @swagger
 * /api/v1/settings/registration:
 *   put:
 *     summary: updateRegistrationSettings
 *     operationId: putSettingsRegistration
 *     description: Audited, because opening public sign-up is a security-relevant change.
 *     tags: [settingsRegistration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated registration configuration
 *       400:
 *         description: A requested registration type is not offered by this deployment
 *       403:
 *         description: Forbidden - requires settings:manage
 */
router.put(
  '/',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const dto = RegistrationSettingsSchema.parse(req.body);
    const data = await service.update(callerOrg(req), dto, req.userId ?? null);
    res.json({ success: true, data });
  })
);

export default router;
