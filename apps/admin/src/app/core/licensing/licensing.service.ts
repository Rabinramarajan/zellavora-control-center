import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  LicensePlan,
  OrganizationLicense,
  LicenseUsage,
  FeatureEntitlement,
  ModuleAccess,
  UsageLimitCheck,
  LicenseStatus,
  UsageMetric,
  USAGE_EVENT_TYPES,
} from '../../shared/models/licensing.model';

@Injectable({
  providedIn: 'root',
})
export class LicensingService {
  // ========================================
  // Signals
  // ========================================

  currentLicense = signal<OrganizationLicense | null>(null);
  currentPlan = signal<LicensePlan | null>(null);
  availablePlans = signal<LicensePlan[]>([]);
  currentUsage = signal<LicenseUsage | null>(null);
  usageLimits = signal<UsageLimitCheck | null>(null);
  features = signal<FeatureEntitlement[]>([]);
  modules = signal<ModuleAccess[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // ========================================
  // Computed
  // ========================================

  licenseStatus = computed<LicenseStatus | null>(() => {
    const license = this.currentLicense();
    const plan = this.currentPlan();

    if (!license || !plan) return null;

    const now = new Date();
    const daysRemaining = license.expiresAt
      ? Math.ceil((new Date(license.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : undefined;

    return {
      planName: plan.name,
      planTier: plan.tier,
      status: license.status,
      daysRemaining,
      expiresAt: license.expiresAt,
      isTrialEnding: license.status === 'trial' && daysRemaining !== undefined && daysRemaining <= 3,
      isExpiringSoon: daysRemaining !== undefined && daysRemaining <= 30,
      canUpgrade: license.status === 'active' || license.status === 'trial',
    };
  });

  enabledFeatures = computed<FeatureEntitlement[]>(() => {
    return this.features().filter(f => f.enabled);
  });

  enabledModules = computed<ModuleAccess[]>(() => {
    return this.modules().filter(m => m.enabled);
  });

  usageMetrics = computed<UsageMetric[]>(() => {
    const usage = this.currentUsage();
    const license = this.currentLicense();
    const plan = this.currentPlan();

    if (!usage || !plan) return [];

    const maxUsers = license?.customUsersOverride || plan.maxUsers;
    const maxStorage = license?.customStorageOverride || plan.maxStorageGb;
    const maxProjects = license?.customProjectsOverride || plan.maxProjects;
    const maxApiCalls = plan.maxApiCallsPerDay;

    return [
      {
        name: 'Users',
        used: usage.activeUsers,
        limit: maxUsers,
        percentage: (usage.activeUsers / maxUsers) * 100,
        status: usage.activeUsers >= maxUsers ? 'critical' :
                usage.activeUsers >= maxUsers * 0.8 ? 'warning' : 'ok',
      },
      {
        name: 'Storage',
        used: usage.storageUsedGb,
        limit: maxStorage,
        percentage: (usage.storageUsedGb / maxStorage) * 100,
        status: usage.storageUsedGb >= maxStorage ? 'critical' :
                usage.storageUsedGb >= maxStorage * 0.8 ? 'warning' : 'ok',
      },
      {
        name: 'Projects',
        used: usage.projectsCreated,
        limit: maxProjects,
        percentage: (usage.projectsCreated / maxProjects) * 100,
        status: usage.projectsCreated >= maxProjects ? 'critical' :
                usage.projectsCreated >= maxProjects * 0.8 ? 'warning' : 'ok',
      },
      {
        name: 'API Calls',
        used: usage.apiCallsUsed,
        limit: maxApiCalls,
        percentage: (usage.apiCallsUsed / maxApiCalls) * 100,
        status: usage.apiCallsUsed >= maxApiCalls ? 'critical' :
                usage.apiCallsUsed >= maxApiCalls * 0.8 ? 'warning' : 'ok',
      },
    ];
  });

  isWithinLimits = computed<boolean>(() => {
    const limits = this.usageLimits();
    return limits ? limits.withinLimits : true;
  });

  hasExceededStorage = computed<boolean>(() => {
    const metrics = this.usageMetrics();
    const storageMetric = metrics.find(m => m.name === 'Storage');
    return storageMetric ? storageMetric.status === 'critical' : false;
  });

  hasExceededUsers = computed<boolean>(() => {
    const metrics = this.usageMetrics();
    const userMetric = metrics.find(m => m.name === 'Users');
    return userMetric ? userMetric.status === 'critical' : false;
  });

  canAccessModule = (moduleKey: string) => {
    return computed(() => {
      const mods = this.modules();
      return mods.some(m => m.moduleKey === moduleKey && m.enabled);
    });
  };

  hasFeature = (featureKey: string) => {
    return computed(() => {
      const feats = this.features();
      return feats.some(f => f.featureKey === featureKey && f.enabled);
    });
  };

  // ========================================
  // Effects
  // ========================================

  constructor(private http: HttpClient, private organizationService: any) {
    // Auto-load license when organization changes
    effect(() => {
      const orgId = this.organizationService.currentOrganization()?.id;
      if (orgId) {
        this.loadLicense(orgId);
      }
    });
  }

  // ========================================
  // Load Data
  // ========================================

  async loadLicense(organizationId: string): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const license = await firstValueFrom(
        this.http.get<OrganizationLicense>(
          `/api/v1/organizations/${organizationId}/license`
        )
      );

      this.currentLicense.set(license);

      if (license) {
        const plan = await firstValueFrom(
          this.http.get<LicensePlan>(`/api/v1/licensing/plans/${license.licensePlanId}`)
        );
        this.currentPlan.set(plan);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load license';
      this.error.set(message);
      console.error('Failed to load license', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadPlans(): Promise<void> {
    try {
      const plans = await firstValueFrom(
        this.http.get<LicensePlan[]>('/api/v1/licensing/plans')
      );
      this.availablePlans.set(plans);
    } catch (err) {
      console.error('Failed to load plans', err);
    }
  }

  async loadUsage(organizationId: string): Promise<void> {
    try {
      this.isLoading.set(true);
      const usage = await firstValueFrom(
        this.http.get<LicenseUsage>(
          `/api/v1/organizations/${organizationId}/license/usage`
        )
      );
      this.currentUsage.set(usage);

      const limits = await firstValueFrom(
        this.http.get<UsageLimitCheck>(
          `/api/v1/organizations/${organizationId}/license/check-limits`
        )
      );
      this.usageLimits.set(limits);
    } catch (err) {
      console.error('Failed to load usage', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadFeatures(organizationId: string): Promise<void> {
    try {
      const features = await firstValueFrom(
        this.http.get<FeatureEntitlement[]>(
          `/api/v1/organizations/${organizationId}/license/features`
        )
      );
      this.features.set(features);

      const modules = await firstValueFrom(
        this.http.get<ModuleAccess[]>(
          `/api/v1/organizations/${organizationId}/license/modules`
        )
      );
      this.modules.set(modules);
    } catch (err) {
      console.error('Failed to load features', err);
    }
  }

  // ========================================
  // Operations
  // ========================================

  async activateTrial(organizationId: string, planId: string, trialDays: number = 14): Promise<boolean> {
    try {
      this.isLoading.set(true);
      const result = await firstValueFrom(
        this.http.post<OrganizationLicense>(
          `/api/v1/organizations/${organizationId}/license/activate-trial`,
          { planId, trialDays }
        )
      );
      this.currentLicense.set(result);
      await this.loadLicense(organizationId);
      return true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to activate trial');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async changePlan(
    organizationId: string,
    newPlanId: string,
    billingCycle: 'monthly' | 'quarterly' | 'annual' = 'monthly'
  ): Promise<boolean> {
    try {
      this.isLoading.set(true);
      const result = await firstValueFrom(
        this.http.post<OrganizationLicense>(
          `/api/v1/organizations/${organizationId}/license/change-plan`,
          { newPlanId, billingCycle }
        )
      );
      this.currentLicense.set(result);
      await this.loadLicense(organizationId);
      return true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to change plan');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async trackUsage(
    organizationId: string,
    eventType: string,
    quantity: number = 1,
    resourceType?: string,
    resourceId?: string
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(
          `/api/v1/organizations/${organizationId}/license/usage/track`,
          { eventType, quantity, resourceType, resourceId }
        )
      );
    } catch (err) {
      console.error('Failed to track usage', err);
      // Don't fail if usage tracking fails
    }
  }

  // ========================================
  // Convenience Methods
  // ========================================

  trackFileUpload(organizationId: string, sizeGb: number): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.FILE_UPLOADED, 1, 'file', sizeGb.toString());
  }

  trackReportGenerated(organizationId: string, reportId: string): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.REPORT_GENERATED, 1, 'report', reportId);
  }

  trackApiCall(organizationId: string): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.API_CALL);
  }

  trackUserAdded(organizationId: string, userId: string): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.USER_ADDED, 1, 'user', userId);
  }

  trackProjectCreated(organizationId: string, projectId: string): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.PROJECT_CREATED, 1, 'project', projectId);
  }

  trackWorkflowTriggered(organizationId: string, workflowId: string): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.WORKFLOW_TRIGGERED, 1, 'workflow', workflowId);
  }

  trackAiRequest(organizationId: string): Promise<void> {
    return this.trackUsage(organizationId, USAGE_EVENT_TYPES.AI_REQUEST);
  }

  // ========================================
  // Checks
  // ========================================

  async checkFeature(organizationId: string, featureKey: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ feature: string; enabled: boolean }>(
          `/api/v1/organizations/${organizationId}/license/features/${featureKey}`
        )
      );
      return result.enabled;
    } catch {
      return false;
    }
  }

  async checkModule(organizationId: string, moduleKey: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ module: string; enabled: boolean }>(
          `/api/v1/organizations/${organizationId}/license/modules/${moduleKey}`
        )
      );
      return result.enabled;
    } catch {
      return false;
    }
  }

  // ========================================
  // Cache Management
  // ========================================

  clearCache(): void {
    this.currentLicense.set(null);
    this.currentPlan.set(null);
    this.currentUsage.set(null);
    this.usageLimits.set(null);
    this.features.set([]);
    this.modules.set([]);
    this.error.set(null);
  }
}
