import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SubscriptionService } from '../services/subscription.service';

export function createLicensingRoutes(subscriptionService: SubscriptionService): Router {
  const router = Router();

  // ========================================
  // Plans
  // ========================================

  /**
   * GET /api/v1/licensing/plans
   * Get all available license plans
   */
  /**
   * @swagger
   * /api/v1/licensing/plans:
   *   get:
   *     summary: getAllAvailableLicensePlans
   *     tags: [licensing]
   *     security: []
   *     responses:
   *       200:
   *         description: List of license plans
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     format: uuid
   *                   name:
   *                     type: string
   *                   price:
   *                     type: number
   *                   features:
   *                     type: object
   */
  router.get('/plans', async (req: Request, res: Response) => {
    try {
      const plans = await subscriptionService.getAvailablePlans();
      res.json(plans);
    } catch (error) {
      console.error('Failed to get plans', error);
      res.status(500).json({ error: 'Failed to get plans' });
    }
  });

  /**
   * GET /api/v1/licensing/plans/:planId
   * Get single plan details
   */
  router.get('/plans/:planId', async (req: Request, res: Response) => {
    try {
      const plan = await subscriptionService.getLicensePlan(req.params.planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      res.json(plan);
    } catch (error) {
      console.error('Failed to get plan', error);
      res.status(500).json({ error: 'Failed to get plan' });
    }
  });

  // ========================================
  // Organization License
  // ========================================

  /**
   * GET /api/v1/organizations/:orgId/license
   * Get organization's current license
   */
  /**
   * @swagger
   * /api/v1/licensing/{orgId}/license:
   *   get:
   *     summary: getOrganizationsCurrentLicense
   *     tags: [licensing]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orgId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Organization license details
   *       404:
   *         description: License not found
   */
  router.get('/:orgId/license', async (req: Request, res: Response) => {
    try {
      const license = await subscriptionService.getOrganizationLicense(req.params.orgId);
      if (!license) return res.status(404).json({ error: 'License not found' });
      res.json(license);
    } catch (error) {
      console.error('Failed to get license', error);
      res.status(500).json({ error: 'Failed to get license' });
    }
  });

  /**
   * POST /api/v1/organizations/:orgId/license/activate-trial
   * Activate trial for organization
   */
  router.post('/:orgId/license/activate-trial', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        planId: z.string().uuid(),
        trialDays: z.number().int().min(1).max(365).optional(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      const license = await subscriptionService.activateTrial(
        req.params.orgId,
        body.planId,
        body.trialDays || 14,
        userId
      );

      if (!license) return res.status(400).json({ error: 'Failed to activate trial' });
      res.json(license);
    } catch (error) {
      console.error('Failed to activate trial', error);
      res.status(500).json({ error: 'Failed to activate trial' });
    }
  });

  /**
   * POST /api/v1/organizations/:orgId/license/change-plan
   * Upgrade or downgrade plan
   */
  router.post('/:orgId/license/change-plan', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        newPlanId: z.string().uuid(),
        billingCycle: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      const license = await subscriptionService.changePlan(
        req.params.orgId,
        body.newPlanId,
        body.billingCycle,
        userId
      );

      if (!license) return res.status(400).json({ error: 'Failed to change plan' });
      res.json(license);
    } catch (error) {
      console.error('Failed to change plan', error);
      res.status(500).json({ error: 'Failed to change plan' });
    }
  });

  // ========================================
  // Usage Tracking
  // ========================================

  /**
   * GET /api/v1/organizations/:orgId/license/usage
   * Get current license usage
   */
  router.get('/:orgId/license/usage', async (req: Request, res: Response) => {
    try {
      const usage = await subscriptionService.getLicenseUsage(req.params.orgId);
      if (!usage) return res.status(404).json({ error: 'Usage data not found' });
      res.json(usage);
    } catch (error) {
      console.error('Failed to get usage', error);
      res.status(500).json({ error: 'Failed to get usage' });
    }
  });

  /**
   * POST /api/v1/organizations/:orgId/license/usage/track
   * Track usage event
   */
  router.post('/:orgId/license/usage/track', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        eventType: z.string(),
        quantity: z.number().int().positive().default(1),
        resourceType: z.string().optional(),
        resourceId: z.string().optional(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      await subscriptionService.trackUsageEvent(
        req.params.orgId,
        userId,
        body.eventType,
        body.quantity,
        body.resourceType,
        body.resourceId
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to track usage', error);
      res.status(500).json({ error: 'Failed to track usage' });
    }
  });

  /**
   * GET /api/v1/organizations/:orgId/license/check-limits
   * Check usage limits and get warnings
   */
  router.get('/:orgId/license/check-limits', async (req: Request, res: Response) => {
    try {
      const limits = await subscriptionService.checkUsageLimits(req.params.orgId);
      res.json(limits);
    } catch (error) {
      console.error('Failed to check limits', error);
      res.status(500).json({ error: 'Failed to check limits' });
    }
  });

  // ========================================
  // Features & Modules
  // ========================================

  /**
   * GET /api/v1/organizations/:orgId/license/features
   * Get all feature entitlements
   */
  router.get('/:orgId/license/features', async (req: Request, res: Response) => {
    try {
      const features = await subscriptionService.getFeatureEntitlements(req.params.orgId);
      res.json(features);
    } catch (error) {
      console.error('Failed to get features', error);
      res.status(500).json({ error: 'Failed to get features' });
    }
  });

  /**
   * GET /api/v1/organizations/:orgId/license/features/:featureKey
   * Check if feature is enabled
   */
  router.get('/:orgId/license/features/:featureKey', async (req: Request, res: Response) => {
    try {
      const enabled = await subscriptionService.hasFeature(
        req.params.orgId,
        req.params.featureKey
      );
      res.json({ feature: req.params.featureKey, enabled });
    } catch (error) {
      console.error('Failed to check feature', error);
      res.status(500).json({ error: 'Failed to check feature' });
    }
  });

  /**
   * GET /api/v1/organizations/:orgId/license/modules
   * Get all module access
   */
  router.get('/:orgId/license/modules', async (req: Request, res: Response) => {
    try {
      const modules = await subscriptionService.getModuleAccess(req.params.orgId);
      res.json(modules);
    } catch (error) {
      console.error('Failed to get modules', error);
      res.status(500).json({ error: 'Failed to get modules' });
    }
  });

  /**
   * GET /api/v1/organizations/:orgId/license/modules/:moduleKey
   * Check if module is accessible
   */
  router.get('/:orgId/license/modules/:moduleKey', async (req: Request, res: Response) => {
    try {
      const enabled = await subscriptionService.hasModuleAccess(
        req.params.orgId,
        req.params.moduleKey
      );
      res.json({ module: req.params.moduleKey, enabled });
    } catch (error) {
      console.error('Failed to check module access', error);
      res.status(500).json({ error: 'Failed to check module access' });
    }
  });

  // ========================================
  // Health Checks (Background Jobs)
  // ========================================

  /**
   * POST /api/v1/licensing/check-expirations
   * Background job: check for expiring licenses and send notifications
   */
  router.post('/check-expirations', async (req: Request, res: Response) => {
    try {
      // Verify this is an internal request
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await subscriptionService.checkExpirations();
      await subscriptionService.checkTrialExpirations();

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to check expirations', error);
      res.status(500).json({ error: 'Failed to check expirations' });
    }
  });

  return router;
}
