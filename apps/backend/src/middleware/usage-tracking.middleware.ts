import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription.service';

/**
 * Usage tracking middleware
 * Automatically tracks various API operations for licensing
 */
export class UsageTrackingMiddleware {
  constructor(private subscriptionService: SubscriptionService) {}

  /**
   * Track HTTP requests for API usage
   */
  track() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      // Intercept response
      const originalSend = res.send;
      res.send = function (data: any) {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        // Only track successful API calls
        if (status >= 200 && status < 400 && organizationId && user) {
          this.subscriptionService
            .trackUsageEvent(
              organizationId,
              user.id,
              'api_call',
              1,
              'endpoint',
              req.method + ' ' + req.path
            )
            .catch((err) => console.error('Failed to track usage', err));
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Track file uploads
   */
  trackFileUpload() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      if ((req as any).file && organizationId && user) {
        const sizeGb = ((req as any).file.size || 0) / (1024 * 1024 * 1024);
        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'file_uploaded',
          1,
          'file',
          (req as any).file.filename
        );

        // Also track storage if size is significant
        if (sizeGb > 0) {
          await this.subscriptionService.trackUsageEvent(
            organizationId,
            user.id,
            'storage_used',
            Math.ceil(sizeGb * 1024), // Track in MB for precision
            'file',
            (req as any).file.filename
          );
        }
      }

      next();
    };
  }

  /**
   * Track report generation
   */
  trackReportGeneration() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      // Only track if request is for report generation
      if (req.path.includes('/report') && req.method === 'POST' && organizationId && user) {
        const reportId = req.body?.id || 'unknown-report';

        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'report_generated',
          1,
          'report',
          reportId
        );
      }

      next();
    };
  }

  /**
   * Track user creation (for user quota)
   */
  trackUserProvisioning() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      // Track POST to users endpoint
      if (
        req.path.includes('/users') &&
        req.method === 'POST' &&
        organizationId &&
        user &&
        res.statusCode === 201
      ) {
        const newUserId = req.body?.id || 'unknown-user';

        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'user_added',
          1,
          'user',
          newUserId
        );
      }

      next();
    };
  }

  /**
   * Track project creation
   */
  trackProjectCreation() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      if (
        req.path.includes('/projects') &&
        req.method === 'POST' &&
        organizationId &&
        user &&
        res.statusCode === 201
      ) {
        const projectId = req.body?.id || 'unknown-project';

        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'project_created',
          1,
          'project',
          projectId
        );
      }

      next();
    };
  }

  /**
   * Track workflow execution
   */
  trackWorkflowExecution() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      if (
        req.path.includes('/workflows') &&
        req.path.includes('/execute') &&
        req.method === 'POST' &&
        organizationId &&
        user
      ) {
        const workflowId = req.params?.workflowId || 'unknown-workflow';

        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'workflow_triggered',
          1,
          'workflow',
          workflowId
        );
      }

      next();
    };
  }

  /**
   * Track AI feature usage
   */
  trackAiUsage() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      if (
        (req.path.includes('/ai') ||
          req.path.includes('/chat') ||
          req.path.includes('/generate')) &&
        req.method === 'POST' &&
        organizationId &&
        user
      ) {
        // Track tokens used if available
        const tokensUsed = req.body?.tokens || 1;

        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'ai_request',
          tokensUsed,
          'ai',
          req.path
        );
      }

      next();
    };
  }

  /**
   * Track integration connections
   */
  trackIntegrationConnection() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const organizationId = this.extractOrganizationId(req);

      if (
        req.path.includes('/integrations') &&
        req.method === 'POST' &&
        organizationId &&
        user &&
        res.statusCode === 201
      ) {
        const integrationName = req.body?.type || 'unknown';

        await this.subscriptionService.trackUsageEvent(
          organizationId,
          user.id,
          'integration_connected',
          1,
          'integration',
          integrationName
        );
      }

      next();
    };
  }

  /**
   * Middleware to enforce license limits
   */
  enforceLimits() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const organizationId = this.extractOrganizationId(req);

      if (!organizationId) {
        return next();
      }

      try {
        const limits = await this.subscriptionService.checkUsageLimits(organizationId);

        if (!limits.withinLimits) {
          // Check if this is a limit-exceeding operation
          const limitType = this.getLimitTypeFromPath(req.path);

          if (limits.errors.some((e) => e.includes(limitType))) {
            return res.status(402).json({
              error: 'License limit exceeded',
              limitType,
              details: limits.errors,
              action: 'upgrade',
            });
          }
        }

        // Add usage info to request for later use
        (req as any).usageLimits = limits;
        next();
      } catch (err) {
        console.error('Failed to check limits', err);
        // Fail open - don't block if check fails
        next();
      }
    };
  }

  /**
   * Middleware to check feature access
   */
  requireFeature(featureKey: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const organizationId = this.extractOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({ error: 'Not authorized' });
      }

      try {
        const hasFeature = await this.subscriptionService.hasFeature(organizationId, featureKey);

        if (!hasFeature) {
          return res.status(403).json({
            error: 'Feature not available in current plan',
            feature: featureKey,
            action: 'upgrade',
          });
        }

        next();
      } catch (err) {
        console.error('Failed to check feature', err);
        res.status(500).json({ error: 'Failed to check feature access' });
      }
    };
  }

  /**
   * Middleware to check module access
   */
  requireModule(moduleKey: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const organizationId = this.extractOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({ error: 'Not authorized' });
      }

      try {
        const hasModule = await this.subscriptionService.hasModuleAccess(organizationId, moduleKey);

        if (!hasModule) {
          return res.status(403).json({
            error: 'Module not available in current plan',
            module: moduleKey,
            action: 'upgrade',
          });
        }

        next();
      } catch (err) {
        console.error('Failed to check module', err);
        res.status(500).json({ error: 'Failed to check module access' });
      }
    };
  }

  /**
   * Private helper methods
   */

  private extractOrganizationId(req: Request): string | null {
    // Try to extract from URL params
    const params = req.params as Record<string, string>;
    if (params.orgId) return params.orgId;

    // Try from JWT token
    const user = (req as any).user;
    if (user?.organizationId) return user.organizationId;

    // Try from header
    const orgHeader = req.headers['x-organization-id'];
    if (typeof orgHeader === 'string') return orgHeader;

    return null;
  }

  private getLimitTypeFromPath(path: string): string {
    if (path.includes('/users')) return 'Users';
    if (path.includes('/files') || path.includes('/upload')) return 'Storage';
    if (path.includes('/projects')) return 'Projects';
    if (path.includes('/api')) return 'API';
    return 'Unknown';
  }
}

/**
 * Factory function to create usage tracking middleware
 */
export function createUsageTrackingMiddleware(subscriptionService: SubscriptionService) {
  return new UsageTrackingMiddleware(subscriptionService);
}
