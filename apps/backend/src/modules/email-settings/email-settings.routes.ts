/**
 * System email configuration API — mounted at /api/v1/settings/email.
 *
 * Every route requires `settings:manage`: the payload governs outbound mail
 * for the whole deployment, including password-reset delivery.
 */
import { Router, type Response, type Router as ExpressRouter } from 'express';
import { authenticate, requirePlatformAdmin, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { createRateLimiter, userOrIpKey } from '../../middleware/rate-limit';
import { EmailSettingsService } from './email-settings.service';
import { EmailSettingsSchema, TestEmailSchema } from './email-settings.dto';

const router: ExpressRouter = Router();
const service = new EmailSettingsService();

// Test sends dispatch real mail to an arbitrary address, so they are capped
// well below the normal admin API budget to keep the endpoint from being used
// as a relay.
const testLimiter = createRateLimiter({
  bucket: 'settings:email-test',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userOrIpKey,
});

/**
 * @swagger
 * tags:
 *   name: settingsEmail
 *   description: System-wide outbound email (SMTP) configuration. Platform administrators only, because one setting serves every organization.
 */

/**
 * @swagger
 * /api/v1/settings/email:
 *   get:
 *     summary: getEmailSettings
 *     operationId: getSettingsEmail
 *     description: Effective outbound email configuration. Secrets are masked.
 *     tags: [settingsEmail]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current email configuration
 *       403:
 *         description: Forbidden - requires a platform administrator
 */
router.get(
  '/',
  authenticate,
  requirePlatformAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      message: 'Email settings retrieved successfully',
      data: await service.get(),
    });
  })
);

/**
 * @swagger
 * /api/v1/settings/email:
 *   put:
 *     summary: updateEmailSettings
 *     operationId: putSettingsEmail
 *     description: >
 *       Replaces the outbound email configuration. Omit a secret field to keep
 *       the stored value, or send an empty string to clear it.
 *     tags: [settingsEmail]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Updated email configuration
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - requires a platform administrator
 */
router.put(
  '/',
  authenticate,
  requirePlatformAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const input = EmailSettingsSchema.parse(req.body);
    res.json({
      success: true,
      message: 'Email settings updated successfully',
      data: await service.update(input, req.userId ?? null),
    });
  })
);

/**
 * @swagger
 * /api/v1/settings/email/test:
 *   post:
 *     summary: sendTestEmail
 *     operationId: postSettingsEmailTest
 *     description: Sends a real message using the saved configuration.
 *     tags: [settingsEmail]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Test result (success or the provider's error)
 *       429:
 *         description: Too many test sends
 */
router.post(
  '/test',
  authenticate,
  requirePlatformAdmin,
  testLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { to } = TestEmailSchema.parse(req.body);
    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: await service.sendTest(to, req.userId ?? null),
    });
  })
);

export default router;
