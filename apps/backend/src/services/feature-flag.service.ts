import { createClient } from '@supabase/supabase-js';
import { RedisClient } from '../infrastructure/redis';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  status: string;
  percentageRollout: number;
  rolloutStrategy?: string;
  targetingEnabled: boolean;
  dependsOn?: string[];
  blocks?: string[];
  scheduledAt?: Date;
  expiresAt?: Date;
  rolloutStartDate?: Date;
  rolloutEndDate?: Date;
  metadata?: Record<string, any>;
}

export interface EvaluationContext {
  userId: string;
  organizationId: string;
  tenantId?: string;
  userRole?: string;
  country?: string;
  environment?: string;
  clientVersion?: string;
  subscriptionLevel?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FeatureFlagEvaluation {
  flagKey: string;
  enabled: boolean;
  reason: string;
  targetingRules?: string[];
  dependencies?: string[];
}

export class FeatureFlagService {
  private supabase: ReturnType<typeof createClient>;
  private redis: RedisClient;
  private readonly CACHE_TTL = 5 * 60; // 5 minutes
  private readonly CACHE_PREFIX = 'feature:';

  constructor(supabase: ReturnType<typeof createClient>, redis: RedisClient) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Evaluate if feature flag is enabled for user
   */
  async isEnabled(
    flagKey: string,
    organizationId: string,
    context: EvaluationContext
  ): Promise<boolean> {
    try {
      const evaluation = await this.evaluateFlag(flagKey, organizationId, context);
      return evaluation.enabled;
    } catch (error) {
      console.error('Feature flag evaluation failed', error);
      return false; // Fail safe - disable feature if error
    }
  }

  /**
   * Get all enabled features for user
   */
  async getEnabledFeatures(
    organizationId: string,
    context: EvaluationContext
  ): Promise<string[]> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(organizationId, context.userId);
      const cached = await this.redis.get<{ enabled: string[] }>(cacheKey);
      if (cached) return cached.enabled;

      // Get all flags for organization
      const { data: flags, error } = await this.supabase
        .from('feature_flags')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true);

      if (error || !flags) return [];

      // Evaluate each flag
      const enabled: string[] = [];
      for (const flag of flags) {
        const evaluation = await this.evaluateFlag(flag.key, organizationId, context);
        if (evaluation.enabled) {
          enabled.push(flag.key);
        }
      }

      // Cache for 5 minutes
      await this.redis.set(cacheKey, { enabled, disabled: [] }, this.CACHE_TTL);

      return enabled;
    } catch (error) {
      console.error('Failed to get enabled features', error);
      return [];
    }
  }

  /**
   * Evaluate a single flag with full context
   */
  async evaluateFlag(
    flagKey: string,
    organizationId: string,
    context: EvaluationContext
  ): Promise<FeatureFlagEvaluation> {
    try {
      // Get flag configuration
      const { data: flag, error } = await this.supabase
        .from('feature_flags')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('key', flagKey)
        .single();

      if (error || !flag) {
        return {
          flagKey,
          enabled: false,
          reason: 'Feature flag not found',
        };
      }

      // Check if flag is globally disabled
      if (!flag.enabled) {
        return {
          flagKey,
          enabled: false,
          reason: 'Feature flag globally disabled',
        };
      }

      // Check scheduling
      const now = new Date();
      if (flag.scheduled_at && now < new Date(flag.scheduled_at)) {
        return {
          flagKey,
          enabled: false,
          reason: 'Feature flag not yet scheduled',
        };
      }

      if (flag.expires_at && now > new Date(flag.expires_at)) {
        return {
          flagKey,
          enabled: false,
          reason: 'Feature flag has expired',
        };
      }

      // Check dependencies
      if (flag.depends_on && flag.depends_on.length > 0) {
        for (const depKey of flag.depends_on) {
          const depEnabled = await this.isEnabled(depKey, organizationId, context);
          if (!depEnabled) {
            return {
              flagKey,
              enabled: false,
              reason: `Dependent feature ${depKey} is not enabled`,
              dependencies: flag.depends_on,
            };
          }
        }
      }

      // Check overrides first
      const override = await this.getOverride(flagKey, organizationId, context);
      if (override !== null) {
        return {
          flagKey,
          enabled: override,
          reason: override ? 'Enabled by user/tenant override' : 'Disabled by override',
        };
      }

      // Check targeting rules
      if (flag.targeting_enabled) {
        const targetingMatch = await this.checkTargetingRules(
          flag.id,
          organizationId,
          context
        );

        if (targetingMatch !== undefined) {
          return {
            flagKey,
            enabled: targetingMatch,
            reason: targetingMatch ? 'Matches targeting rule' : 'Does not match targeting rules',
            targetingRules: this.getMatchedRules(flag.id, context),
          };
        }
      }

      // Check percentage rollout
      if (flag.percentage_rollout > 0 && flag.percentage_rollout < 100) {
        const userHash = this.hashUserId(context.userId, flagKey);
        const normalizedHash = (userHash % 100) + 1;

        const isEnabled = normalizedHash <= flag.percentage_rollout;
        if (!isEnabled) {
          return {
            flagKey,
            enabled: false,
            reason: `User not in ${flag.percentage_rollout}% rollout`,
          };
        }
      }

      return {
        flagKey,
        enabled: true,
        reason: 'Enabled for user',
      };
    } catch (error) {
      console.error('Flag evaluation error', error);
      return {
        flagKey,
        enabled: false,
        reason: 'Evaluation error',
      };
    }
  }

  /**
   * Get flag override for user/tenant
   */
  private async getOverride(
    flagKey: string,
    organizationId: string,
    context: EvaluationContext
  ): Promise<boolean | null> {
    try {
      // Get flag ID
      const { data: flag } = await this.supabase
        .from('feature_flags')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('key', flagKey)
        .single();

      if (!flag) return null;

      // Check user override
      const { data: userOverride } = await this.supabase
        .from('feature_flag_overrides')
        .select('enabled')
        .eq('feature_flag_id', flag.id)
        .eq('override_type', 'user')
        .eq('target_id', context.userId)
        .or('expires_at.is.null,expires_at.gt.now()')
        .single();

      if (userOverride) return userOverride.enabled;

      // Check tenant override
      if (context.tenantId) {
        const { data: tenantOverride } = await this.supabase
          .from('feature_flag_overrides')
          .select('enabled')
          .eq('feature_flag_id', flag.id)
          .eq('override_type', 'tenant')
          .eq('target_id', context.tenantId)
          .or('expires_at.is.null,expires_at.gt.now()')
          .single();

        if (tenantOverride) return tenantOverride.enabled;
      }

      // Check role override
      if (context.userRole) {
        const { data: roleOverride } = await this.supabase
          .from('feature_flag_overrides')
          .select('enabled')
          .eq('feature_flag_id', flag.id)
          .eq('override_type', 'role')
          .eq('target_id', context.userRole)
          .or('expires_at.is.null,expires_at.gt.now()')
          .single();

        if (roleOverride) return roleOverride.enabled;
      }

      return null;
    } catch (error) {
      console.error('Override check failed', error);
      return null;
    }
  }

  /**
   * Check targeting rules
   */
  private async checkTargetingRules(
    flagId: string,
    organizationId: string,
    context: EvaluationContext
  ): Promise<boolean | undefined> {
    try {
      const { data: toggles } = await this.supabase
        .from('feature_flag_toggles')
        .select('*')
        .eq('feature_flag_id', flagId)
        .eq('enabled', true)
        .order('priority', { ascending: false });

      if (!toggles || toggles.length === 0) return undefined;

      for (const toggle of toggles) {
        const matches = this.matchesToggle(toggle, context);
        if (matches) {
          // Check percentage
          if (toggle.percentage < 100) {
            const userHash = this.hashUserId(context.userId, `${flagId}-${toggle.id}`);
            const normalized = (userHash % 100) + 1;
            return normalized <= toggle.percentage;
          }
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Targeting rule check failed', error);
      return undefined;
    }
  }

  /**
   * Check if toggle matches context
   */
  private matchesToggle(toggle: any, context: EvaluationContext): boolean {
    switch (toggle.toggle_type) {
      case 'user':
        return context.userId === toggle.target_value;

      case 'role':
        return context.userRole === toggle.target_value;

      case 'tenant':
        return context.tenantId === toggle.target_value;

      case 'environment':
        return context.environment === toggle.target_value;

      case 'country':
        return context.country === toggle.target_value;

      case 'subscription':
        return context.subscriptionLevel === toggle.target_value;

      case 'client_version':
        return this.matchesVersion(
          context.clientVersion || '',
          toggle.target_value,
          toggle.condition
        );

      default:
        return false;
    }
  }

  /**
   * Match version strings
   */
  private matchesVersion(
    version: string,
    targetVersion: string,
    condition: string
  ): boolean {
    switch (condition) {
      case 'equals':
        return version === targetVersion;
      case 'contains':
        return version.includes(targetVersion);
      case 'starts_with':
        return version.startsWith(targetVersion);
      default:
        return false;
    }
  }

  /**
   * Get matched rules (for audit)
   */
  private getMatchedRules(flagId: string, context: EvaluationContext): string[] {
    return [`flag-${flagId}`, `user-${context.userId}`, `role-${context.userRole || 'none'}`];
  }

  /**
   * Hash user ID for percentage rollout
   */
  private hashUserId(userId: string, salt: string): number {
    const combined = `${userId}:${salt}`;
    let hash = 0;

    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }

  /**
   * Audit log flag evaluation
   */
  async auditEvaluation(
    flagKey: string,
    organizationId: string,
    evaluation: FeatureFlagEvaluation,
    userId: string
  ): Promise<void> {
    try {
      // Get flag ID
      const { data: flag } = await this.supabase
        .from('feature_flags')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('key', flagKey)
        .single();

      if (!flag) return;

      // Update evaluation count
      await this.supabase
        .from('feature_flag_audit_logs')
        .update({
          evaluation_count: this.supabase.rpc('increment_evaluation_count'),
          last_evaluated_at: new Date().toISOString(),
        })
        .eq('feature_flag_id', flag.id);
    } catch (error) {
      console.error('Audit log failed', error);
      // Don't fail if audit fails
    }
  }

  /**
   * Get feature flag details
   */
  async getFlag(
    flagKey: string,
    organizationId: string
  ): Promise<FeatureFlag | null> {
    try {
      const { data: flag } = await this.supabase
        .from('feature_flags')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('key', flagKey)
        .single();

      if (!flag) return null;

      return this.transformFlag(flag);
    } catch (error) {
      console.error('Failed to get flag', error);
      return null;
    }
  }

  /**
   * Get all flags
   */
  async getFlags(organizationId: string): Promise<FeatureFlag[]> {
    try {
      const { data: flags } = await this.supabase
        .from('feature_flags')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      return (flags || []).map(f => this.transformFlag(f));
    } catch (error) {
      console.error('Failed to get flags', error);
      return [];
    }
  }

  /**
   * Create flag
   */
  async createFlag(
    organizationId: string,
    flagData: Partial<FeatureFlag>,
    userId: string
  ): Promise<FeatureFlag | null> {
    try {
      const { data: flag, error } = await this.supabase
        .from('feature_flags')
        .insert({
          organization_id: organizationId,
          key: flagData.key,
          name: flagData.name,
          description: flagData.description,
          enabled: flagData.enabled || false,
          status: flagData.status || 'development',
          percentage_rollout: flagData.percentageRollout || 0,
          targeting_enabled: flagData.targetingEnabled !== false,
          depends_on: flagData.dependsOn,
          blocks: flagData.blocks,
          metadata: flagData.metadata,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error || !flag) throw error;

      // Invalidate cache
      await this.invalidateCache(organizationId);

      return this.transformFlag(flag);
    } catch (error) {
      console.error('Failed to create flag', error);
      return null;
    }
  }

  /**
   * Update flag
   */
  async updateFlag(
    flagKey: string,
    organizationId: string,
    updates: Partial<FeatureFlag>,
    userId: string
  ): Promise<FeatureFlag | null> {
    try {
      const { data: flag, error } = await this.supabase
        .from('feature_flags')
        .update({
          name: updates.name,
          description: updates.description,
          enabled: updates.enabled,
          status: updates.status,
          percentage_rollout: updates.percentageRollout,
          targeting_enabled: updates.targetingEnabled,
          depends_on: updates.dependsOn,
          blocks: updates.blocks,
          metadata: updates.metadata,
          updated_by: userId,
        })
        .eq('organization_id', organizationId)
        .eq('key', flagKey)
        .select()
        .single();

      if (error || !flag) throw error;

      // Invalidate cache
      await this.invalidateCache(organizationId);

      return this.transformFlag(flag);
    } catch (error) {
      console.error('Failed to update flag', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */

  private transformFlag(data: any): FeatureFlag {
    return {
      id: data.id,
      key: data.key,
      name: data.name,
      description: data.description,
      enabled: data.enabled,
      status: data.status,
      percentageRollout: data.percentage_rollout,
      rolloutStrategy: data.rollout_strategy,
      targetingEnabled: data.targeting_enabled,
      dependsOn: data.depends_on,
      blocks: data.blocks,
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      rolloutStartDate: data.rollout_start_date
        ? new Date(data.rollout_start_date)
        : undefined,
      rolloutEndDate: data.rollout_end_date
        ? new Date(data.rollout_end_date)
        : undefined,
      metadata: data.metadata,
    };
  }

  private getCacheKey(organizationId: string, userId: string): string {
    return `${this.CACHE_PREFIX}${organizationId}:${userId}`;
  }

  private async invalidateCache(organizationId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}${organizationId}:*`;
    await this.redis.deletePattern(pattern);
  }
}
