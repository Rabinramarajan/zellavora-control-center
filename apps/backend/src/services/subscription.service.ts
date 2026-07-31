import { createClient } from '@supabase/supabase-js';
import { RedisClient } from '../infrastructure/redis';

export interface LicensePlan {
  id: string;
  key: string;
  name: string;
  description?: string;
  tier: number;
  priceMonthly?: number;
  priceAnnual?: number;
  maxUsers: number;
  maxStorageGb: number;
  maxProjects: number;
  maxApiCallsPerDay: number;
  features: Record<string, boolean>;
  modules: string[];
  supportTier?: string;
  responseTimeHours?: number;
  uptimeSla?: number;
}

export interface OrganizationLicense {
  id: string;
  organizationId: string;
  licensePlanId: string;
  subscriptionId?: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled' | 'expired';
  startedAt: Date;
  expiresAt?: Date;
  trialExpiresAt?: Date;
  renewalDate?: Date;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  autoRenew: boolean;
  customUsersOverride?: number;
  customStorageOverride?: number;
  customProjectsOverride?: number;
}

export interface LicenseUsage {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  activeUsers: number;
  storageUsedGb: number;
  projectsCreated: number;
  apiCallsUsed: number;
  status: 'active' | 'over_limit' | 'warned';
}

export interface FeatureEntitlement {
  id: string;
  organizationId: string;
  featureKey: string;
  featureName: string;
  category: string;
  enabled: boolean;
  usageLimit?: number;
}

export interface ModuleAccess {
  moduleKey: string;
  moduleName: string;
  enabled: boolean;
  accessLevel: 'view' | 'edit' | 'admin' | 'manage';
}

export class SubscriptionService {
  private supabase: any;
  private redis: RedisClient;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly USAGE_CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'license:';

  constructor(supabase: ReturnType<typeof createClient>, redis: RedisClient) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Get organization's current license
   */
  async getOrganizationLicense(organizationId: string): Promise<OrganizationLicense | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}org:${organizationId}`;
      const cached = await this.redis.get<OrganizationLicense>(cacheKey);
      if (cached) return cached;

      const { data: license, error } = await this.supabase
        .from('organization_licenses')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error || !license) return null;

      const transformed = this.transformLicense(license);
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get organization license', error);
      return null;
    }
  }

  /**
   * Get license plan details
   */
  async getLicensePlan(planId: string): Promise<LicensePlan | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}plan:${planId}`;
      const cached = await this.redis.get<LicensePlan>(cacheKey);
      if (cached) return cached;

      const { data: plan, error } = await this.supabase
        .from('license_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error || !plan) return null;

      const transformed = this.transformPlan(plan);
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get license plan', error);
      return null;
    }
  }

  /**
   * Get all available plans
   */
  async getAvailablePlans(): Promise<LicensePlan[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}all-plans`;
      const cached = await this.redis.get<LicensePlan[]>(cacheKey);
      if (cached) return cached;

      const { data: plans, error } = await this.supabase
        .from('license_plans')
        .select('*')
        .eq('status', 'active')
        .eq('hide_from_ui', false)
        .order('tier', { ascending: true });

      if (error || !plans) return [];

      const transformed = plans.map((p) => this.transformPlan(p));
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get plans', error);
      return [];
    }
  }

  /**
   * Get license usage for current period
   */
  async getLicenseUsage(organizationId: string): Promise<LicenseUsage | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}usage:${organizationId}`;
      const cached = await this.redis.get<LicenseUsage>(cacheKey);
      if (cached) return cached;

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: usage, error } = await this.supabase
        .from('license_usage')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('period_start', periodStart.toISOString())
        .lte('period_end', periodEnd.toISOString())
        .single();

      if (error || !usage) return null;

      const transformed = this.transformUsage(usage);
      await this.redis.set(cacheKey, transformed, this.USAGE_CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get license usage', error);
      return null;
    }
  }

  /**
   * Check if organization has feature entitlement
   */
  async hasFeature(organizationId: string, featureKey: string): Promise<boolean> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}feature:${organizationId}:${featureKey}`;
      const cached = await this.redis.get<boolean>(cacheKey);
      if (cached !== undefined) return cached;

      const { data: entitlement, error } = await this.supabase
        .from('feature_entitlements')
        .select('enabled')
        .eq('organization_id', organizationId)
        .eq('feature_key', featureKey)
        .single();

      if (error || !entitlement) {
        await this.redis.set(cacheKey, false, this.CACHE_TTL);
        return false;
      }

      const result = entitlement.enabled;
      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      console.error('Failed to check feature entitlement', error);
      return false;
    }
  }

  /**
   * Get all feature entitlements for organization
   */
  async getFeatureEntitlements(organizationId: string): Promise<FeatureEntitlement[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}features:${organizationId}`;
      const cached = await this.redis.get<FeatureEntitlement[]>(cacheKey);
      if (cached) return cached;

      const { data: entitlements, error } = await this.supabase
        .from('feature_entitlements')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true);

      if (error || !entitlements) return [];

      const transformed = entitlements.map((e) => this.transformEntitlement(e));
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get feature entitlements', error);
      return [];
    }
  }

  /**
   * Check if organization has module access
   */
  async hasModuleAccess(organizationId: string, moduleKey: string): Promise<boolean> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}module:${organizationId}:${moduleKey}`;
      const cached = await this.redis.get<boolean>(cacheKey);
      if (cached !== undefined) return cached;

      const { data: access, error } = await this.supabase
        .from('module_access')
        .select('enabled')
        .eq('organization_id', organizationId)
        .eq('module_key', moduleKey)
        .single();

      if (error || !access) {
        await this.redis.set(cacheKey, false, this.CACHE_TTL);
        return false;
      }

      const result = access.enabled;
      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      console.error('Failed to check module access', error);
      return false;
    }
  }

  /**
   * Get all module access for organization
   */
  async getModuleAccess(organizationId: string): Promise<ModuleAccess[]> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}modules:${organizationId}`;
      const cached = await this.redis.get<ModuleAccess[]>(cacheKey);
      if (cached) return cached;

      const { data: modules, error } = await this.supabase
        .from('module_access')
        .select('*')
        .eq('organization_id', organizationId);

      if (error || !modules) return [];

      const transformed = modules.map((m) => ({
        moduleKey: m.module_key,
        moduleName: m.module_name,
        enabled: m.enabled,
        accessLevel: m.access_level || 'view',
      }));

      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get module access', error);
      return [];
    }
  }

  /**
   * Track usage event
   */
  async trackUsageEvent(
    organizationId: string,
    userId: string | null,
    eventType: string,
    quantity: number = 1,
    resourceType?: string,
    resourceId?: string
  ): Promise<void> {
    try {
      await this.supabase.from('usage_events').insert({
        organization_id: organizationId,
        user_id: userId,
        event_type: eventType,
        quantity,
        resource_type: resourceType,
        resource_id: resourceId,
      });

      // Invalidate usage cache
      await this.invalidateUsageCache(organizationId);
    } catch (error) {
      console.error('Failed to track usage event', error);
      // Don't fail if usage tracking fails
    }
  }

  /**
   * Update license usage for period
   */
  async updateLicenseUsage(usage: LicenseUsage): Promise<void> {
    try {
      const { error } = await this.supabase.from('license_usage').upsert({
        organization_id: usage.organizationId,
        period_start: usage.periodStart.toISOString(),
        period_end: usage.periodEnd.toISOString(),
        active_users: usage.activeUsers,
        storage_used_gb: usage.storageUsedGb,
        projects_created: usage.projectsCreated,
        api_calls_used: usage.apiCallsUsed,
        status: usage.status,
      });

      if (error) throw error;

      // Invalidate usage cache
      await this.invalidateUsageCache(usage.organizationId);
    } catch (error) {
      console.error('Failed to update license usage', error);
    }
  }

  /**
   * Check usage limits
   */
  async checkUsageLimits(organizationId: string): Promise<{
    withinLimits: boolean;
    warnings: string[];
    errors: string[];
  }> {
    try {
      const license = await this.getOrganizationLicense(organizationId);
      const usage = await this.getLicenseUsage(organizationId);
      const plan = license && (await this.getLicensePlan(license.licensePlanId));

      if (!license || !usage || !plan) {
        return { withinLimits: false, warnings: [], errors: ['License or usage not found'] };
      }

      const warnings: string[] = [];
      const errors: string[] = [];
      const maxUsers = license.customUsersOverride || plan.maxUsers;
      const maxStorage = license.customStorageOverride || plan.maxStorageGb;
      const maxProjects = license.customProjectsOverride || plan.maxProjects;
      const maxApiCalls = plan.maxApiCallsPerDay;

      // Check users
      if (usage.activeUsers >= maxUsers) {
        errors.push(`User limit (${maxUsers}) reached`);
      } else if (usage.activeUsers >= Math.ceil(maxUsers * 0.8)) {
        warnings.push(`Using ${Math.round((usage.activeUsers / maxUsers) * 100)}% of user limit`);
      }

      // Check storage
      if (usage.storageUsedGb >= maxStorage) {
        errors.push(`Storage limit (${maxStorage}GB) reached`);
      } else if (usage.storageUsedGb >= maxStorage * 0.8) {
        warnings.push(
          `Using ${Math.round((usage.storageUsedGb / maxStorage) * 100)}% of storage limit`
        );
      }

      // Check projects
      if (usage.projectsCreated >= maxProjects) {
        errors.push(`Project limit (${maxProjects}) reached`);
      }

      // Check API calls
      if (usage.apiCallsUsed >= maxApiCalls) {
        errors.push(`API call limit (${maxApiCalls}/day) reached`);
      } else if (usage.apiCallsUsed >= maxApiCalls * 0.8) {
        warnings.push(
          `Using ${Math.round((usage.apiCallsUsed / maxApiCalls) * 100)}% of API limit`
        );
      }

      return {
        withinLimits: errors.length === 0,
        warnings,
        errors,
      };
    } catch (error) {
      console.error('Failed to check usage limits', error);
      return { withinLimits: false, warnings: [], errors: ['Failed to check limits'] };
    }
  }

  /**
   * Upgrade/downgrade plan
   */
  async changePlan(
    organizationId: string,
    newPlanId: string,
    billingCycle: 'monthly' | 'quarterly' | 'annual' = 'monthly',
    userId: string
  ): Promise<OrganizationLicense | null> {
    try {
      const currentLicense = await this.getOrganizationLicense(organizationId);
      if (!currentLicense) return null;

      const { data: updated, error } = await this.supabase
        .from('organization_licenses')
        .update({
          license_plan_id: newPlanId,
          billing_cycle: billingCycle,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error || !updated) throw error;

      // Log renewal history
      await this.supabase.from('renewal_history').insert({
        organization_id: organizationId,
        license_id: updated.id,
        renewal_date: new Date().toISOString(),
        from_plan_id: currentLicense.licensePlanId,
        to_plan_id: newPlanId,
        renewal_type: 'change_billing',
      });

      // Invalidate cache
      await this.invalidateLicenseCache(organizationId);

      return this.transformLicense(updated);
    } catch (error) {
      console.error('Failed to change plan', error);
      return null;
    }
  }

  /**
   * Activate trial for organization
   */
  async activateTrial(
    organizationId: string,
    planId: string,
    trialDays: number = 14,
    userId: string
  ): Promise<OrganizationLicense | null> {
    try {
      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + trialDays);

      const { data: license, error } = await this.supabase
        .from('organization_licenses')
        .upsert({
          organization_id: organizationId,
          license_plan_id: planId,
          status: 'trial',
          trial_expires_at: trialExpiresAt.toISOString(),
          auto_renew: false,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error || !license) throw error;

      // Send notification
      await this.sendNotification(organizationId, 'trial_started', {
        expiresAt: trialExpiresAt,
        planName: await this.getLicensePlan(planId).then((p) => p?.name || 'Trial'),
      });

      // Invalidate cache
      await this.invalidateLicenseCache(organizationId);

      return this.transformLicense(license);
    } catch (error) {
      console.error('Failed to activate trial', error);
      return null;
    }
  }

  /**
   * Send license notification
   */
  async sendNotification(
    organizationId: string,
    notificationType: string,
    context: Record<string, any>
  ): Promise<void> {
    try {
      const notifications: Record<string, { title: string; message: string }> = {
        trial_ending: {
          title: 'Trial Ending Soon',
          message: `Your trial expires in ${context.daysRemaining || 7} days. Upgrade now to keep using all features.`,
        },
        renewal_upcoming: {
          title: 'Renewal Upcoming',
          message: `Your ${context.planName} subscription will renew on ${context.renewalDate}`,
        },
        usage_warning: {
          title: 'Usage Limit Warning',
          message: `You are approaching your ${context.limitType} limit (${context.usage}/${context.limit})`,
        },
        expired: {
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Please renew to regain access.',
        },
        failed_payment: {
          title: 'Payment Failed',
          message: 'Your payment failed. Please update your payment method.',
        },
      };

      const notification = notifications[notificationType];
      if (!notification) return;

      await this.supabase.from('license_notifications').insert({
        organization_id: organizationId,
        notification_type: notificationType,
        title: notification.title,
        message: notification.message,
        status: 'pending',
      });
    } catch (error) {
      console.error('Failed to send notification', error);
      // Don't fail the main operation
    }
  }

  /**
   * Check if license is about to expire
   */
  async checkExpirations(): Promise<void> {
    try {
      const now = new Date();
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: expiring, error } = await this.supabase
        .from('organization_licenses')
        .select('*')
        .eq('status', 'active')
        .lte('expires_at', thirtyDaysAhead.toISOString())
        .gt('expires_at', now.toISOString());

      if (error || !expiring) return;

      for (const license of expiring) {
        const daysRemaining = Math.ceil(
          (new Date(license.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        await this.sendNotification(license.organization_id, 'renewal_upcoming', {
          daysRemaining,
          renewalDate: license.renewal_date,
        });
      }
    } catch (error) {
      console.error('Failed to check expirations', error);
    }
  }

  /**
   * Check trial expiration
   */
  async checkTrialExpirations(): Promise<void> {
    try {
      const now = new Date();
      const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const { data: expiring, error } = await this.supabase
        .from('organization_licenses')
        .select('*')
        .eq('status', 'trial')
        .lte('trial_expires_at', threeDaysAhead.toISOString())
        .gt('trial_expires_at', now.toISOString());

      if (error || !expiring) return;

      for (const license of expiring) {
        const daysRemaining = Math.ceil(
          (new Date(license.trial_expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        await this.sendNotification(license.organization_id, 'trial_ending', {
          daysRemaining,
        });
      }
    } catch (error) {
      console.error('Failed to check trial expirations', error);
    }
  }

  /**
   * Private helper methods
   */

  private transformLicense(data: any): OrganizationLicense {
    return {
      id: data.id,
      organizationId: data.organization_id,
      licensePlanId: data.license_plan_id,
      subscriptionId: data.subscription_id,
      status: data.status,
      startedAt: new Date(data.started_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      trialExpiresAt: data.trial_expires_at ? new Date(data.trial_expires_at) : undefined,
      renewalDate: data.renewal_date ? new Date(data.renewal_date) : undefined,
      billingCycle: data.billing_cycle,
      autoRenew: data.auto_renew,
      customUsersOverride: data.custom_users_override,
      customStorageOverride: data.custom_storage_override,
      customProjectsOverride: data.custom_projects_override,
    };
  }

  private transformPlan(data: any): LicensePlan {
    return {
      id: data.id,
      key: data.key,
      name: data.name,
      description: data.description,
      tier: data.tier,
      priceMonthly: data.price_monthly,
      priceAnnual: data.price_annual,
      maxUsers: data.max_users,
      maxStorageGb: data.max_storage_gb,
      maxProjects: data.max_projects,
      maxApiCallsPerDay: data.max_api_calls_per_day,
      features: data.features || {},
      modules: data.modules || [],
      supportTier: data.support_tier,
      responseTimeHours: data.response_time_hours,
      uptimeSla: data.uptime_sla,
    };
  }

  private transformUsage(data: any): LicenseUsage {
    return {
      organizationId: data.organization_id,
      periodStart: new Date(data.period_start),
      periodEnd: new Date(data.period_end),
      activeUsers: data.active_users,
      storageUsedGb: data.storage_used_gb,
      projectsCreated: data.projects_created,
      apiCallsUsed: data.api_calls_used,
      status: data.status,
    };
  }

  private transformEntitlement(data: any): FeatureEntitlement {
    return {
      id: data.id,
      organizationId: data.organization_id,
      featureKey: data.feature_key,
      featureName: data.feature_name,
      category: data.category,
      enabled: data.enabled,
      usageLimit: data.usage_limit,
    };
  }

  private async invalidateLicenseCache(organizationId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}org:${organizationId}`;
    await this.redis.delete(pattern);
  }

  private async invalidateUsageCache(organizationId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}usage:${organizationId}`;
    await this.redis.delete(pattern);
  }
}
