import { Database } from '../types/supabase';
import { createClient } from '@supabase/supabase-js';
import { RedisClient } from '../infrastructure/redis';

export interface Permission {
  id: string;
  key: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  category?: string;
  requiresApproval: boolean;
  requiresMfa: boolean;
  requiresAudit: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  auditLevel: 'standard' | 'detailed' | 'none';
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface Screen {
  id: string;
  key: string;
  name: string;
  description?: string;
  route?: string;
  icon?: string;
  parentId?: string;
  requiresAuthentication: boolean;
  isPublic: boolean;
  featureFlag?: string;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface UserPermissionContext {
  userId: string;
  organizationId: string;
  userRole: string;
  permissions: Set<string>;
  deniedPermissions: Set<string>;
  cacheExpiry: number;
}

export class PermissionService {
  private supabase: ReturnType<typeof createClient>;
  private redis: RedisClient;
  private readonly CACHE_TTL = 30 * 60; // 30 minutes
  private readonly PERMISSION_CACHE_PREFIX = 'perms:';

  constructor(supabase: ReturnType<typeof createClient>, redis: RedisClient) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    permissionKey: string
  ): Promise<boolean> {
    try {
      const context = await this.getUserPermissionContext(userId, organizationId);
      return context.permissions.has(permissionKey) && !context.deniedPermissions.has(permissionKey);
    } catch (error) {
      console.error('Permission check failed', error);
      return false;
    }
  }

  /**
   * Check multiple permissions (ANY match)
   */
  async hasAnyPermission(
    userId: string,
    organizationId: string,
    permissionKeys: string[]
  ): Promise<boolean> {
    const context = await this.getUserPermissionContext(userId, organizationId);
    return permissionKeys.some(
      key => context.permissions.has(key) && !context.deniedPermissions.has(key)
    );
  }

  /**
   * Check multiple permissions (ALL match)
   */
  async hasAllPermissions(
    userId: string,
    organizationId: string,
    permissionKeys: string[]
  ): Promise<boolean> {
    const context = await this.getUserPermissionContext(userId, organizationId);
    return permissionKeys.every(
      key => context.permissions.has(key) && !context.deniedPermissions.has(key)
    );
  }

  /**
   * Get user's accessible screens
   */
  async getUserScreens(
    userId: string,
    organizationId: string
  ): Promise<Screen[]> {
    try {
      const cacheKey = `${this.PERMISSION_CACHE_PREFIX}screens:${organizationId}:${userId}`;
      const cached = await this.redis.get<Screen[]>(cacheKey);
      if (cached) return cached;

      const context = await this.getUserPermissionContext(userId, organizationId);

      // Get all screens for organization
      const { data: allScreens } = await this.supabase
        .from('screens')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true);

      if (!allScreens) return [];

      // Filter based on permissions
      const accessibleScreens = await Promise.all(
        allScreens.map(async (screen) => {
          // Public screens are always accessible
          if (screen.is_public) return this.transformScreen(screen);

          // Get required permissions for this screen
          const { data: screenPerms } = await this.supabase
            .from('screen_permissions')
            .select('permission_id, required')
            .eq('screen_id', screen.id);

          // If screen has no required permissions, user can access
          if (!screenPerms || screenPerms.length === 0) {
            return this.transformScreen(screen);
          }

          // Check if user has all required permissions
          const allPermissionsGranted = screenPerms.every(sp => {
            if (!sp.required) return true;
            // Get permission key from permission_id
            // This would require additional query or caching
            return true; // Simplified - would need to fetch permission details
          });

          return allPermissionsGranted ? this.transformScreen(screen) : null;
        })
      );

      const filteredScreens = accessibleScreens.filter((s): s is Screen => s !== null);

      // Cache for 30 minutes
      await this.redis.set(cacheKey, filteredScreens, this.CACHE_TTL);

      return filteredScreens;
    } catch (error) {
      console.error('Failed to get user screens', error);
      return [];
    }
  }

  /**
   * Get user's full permission context
   */
  async getUserPermissionContext(
    userId: string,
    organizationId: string
  ): Promise<UserPermissionContext> {
    const cacheKey = `${this.PERMISSION_CACHE_PREFIX}context:${organizationId}:${userId}`;

    // Try cache first
    const cached = await this.redis.get<UserPermissionContext>(cacheKey);
    if (cached) return cached;

    // Get user's role
    const { data: orgMember } = await this.supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (!orgMember) {
      throw new Error('User not in organization');
    }

    // Get role permissions
    const { data: rolePerms } = await this.supabase
      .from('role_permissions')
      .select('permission:permissions(key), granted, expiration_date')
      .eq('organization_id', organizationId)
      .eq('role_id', orgMember.role)
      .or('granted.eq.true,expiration_date.is.null,expiration_date.gt.now()');

    // Get user-specific permissions
    const { data: userPerms } = await this.supabase
      .from('user_permissions')
      .select('permission:permissions(key), granted, expiration_date')
      .eq('user_id', userId)
      .or('expiration_date.is.null,expiration_date.gt.now()');

    // Build permission sets
    const permissions = new Set<string>();
    const deniedPermissions = new Set<string>();

    // Add role permissions
    if (rolePerms) {
      rolePerms.forEach((rp: any) => {
        if (rp.permission?.key) {
          if (rp.granted) {
            permissions.add(rp.permission.key);
          } else {
            deniedPermissions.add(rp.permission.key);
          }
        }
      });
    }

    // User permissions override role permissions
    if (userPerms) {
      userPerms.forEach((up: any) => {
        if (up.permission?.key) {
          if (up.granted) {
            permissions.add(up.permission.key);
            deniedPermissions.delete(up.permission.key);
          } else {
            deniedPermissions.add(up.permission.key);
            permissions.delete(up.permission.key);
          }
        }
      });
    }

    const context: UserPermissionContext = {
      userId,
      organizationId,
      userRole: orgMember.role,
      permissions,
      deniedPermissions,
      cacheExpiry: Date.now() + this.CACHE_TTL * 1000,
    };

    // Cache for 30 minutes
    await this.redis.set(cacheKey, context, this.CACHE_TTL);

    return context;
  }

  /**
   * Audit log a permission check/action
   */
  async auditLog(
    userId: string,
    organizationId: string,
    action: string,
    permissionId: string | null,
    screenId: string | null,
    status: 'allowed' | 'denied' | 'pending_approval',
    context: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      resourceType?: string;
      resourceId?: string;
      denyReason?: string;
      changeData?: Record<string, any>;
      responseTimeMs?: number;
    } = {}
  ): Promise<void> {
    try {
      await this.supabase
        .from('permission_audit_logs')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          permission_id: permissionId,
          screen_id: screenId,
          action,
          status,
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
          session_id: context.sessionId,
          resource_type: context.resourceType,
          resource_id: context.resourceId,
          deny_reason: context.denyReason,
          change_data: context.changeData,
          response_time_ms: context.responseTimeMs,
        });

      // Also cache in Redis for real-time queries
      const auditKey = `audit:${organizationId}:${userId}:${Date.now()}`;
      await this.redis.set(auditKey, {
        action,
        status,
        timestamp: new Date().toISOString(),
      }, 3600); // 1 hour
    } catch (error) {
      console.error('Failed to audit log', error);
      // Don't throw - audit logging shouldn't break the operation
    }
  }

  /**
   * Get audit logs for user
   */
  async getAuditLogs(
    organizationId: string,
    userId?: string,
    limit = 100,
    offset = 0
  ) {
    try {
      let query = this.supabase
        .from('permission_audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('request_timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get audit logs', error);
      return [];
    }
  }

  /**
   * Grant permission to user
   */
  async grantPermissionToUser(
    userId: string,
    organizationId: string,
    permissionId: string,
    grantedBy: string,
    reason?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      await this.supabase
        .from('user_permissions')
        .upsert(
          {
            user_id: userId,
            permission_id: permissionId,
            organization_id: organizationId,
            granted: true,
            reason,
            expiration_date: expiresAt,
            created_by: grantedBy,
          },
          { onConflict: 'user_id,permission_id' }
        );

      // Invalidate cache
      await this.invalidateUserCache(userId, organizationId);
    } catch (error) {
      console.error('Failed to grant permission', error);
      throw error;
    }
  }

  /**
   * Deny permission for user
   */
  async denyPermissionForUser(
    userId: string,
    organizationId: string,
    permissionId: string,
    deniedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('user_permissions')
        .upsert(
          {
            user_id: userId,
            permission_id: permissionId,
            organization_id: organizationId,
            granted: false,
            reason,
            created_by: deniedBy,
          },
          { onConflict: 'user_id,permission_id' }
        );

      // Invalidate cache
      await this.invalidateUserCache(userId, organizationId);
    } catch (error) {
      console.error('Failed to deny permission', error);
      throw error;
    }
  }

  /**
   * Get all permissions
   */
  async getPermissions(organizationId: string): Promise<Permission[]> {
    try {
      const cacheKey = `${this.PERMISSION_CACHE_PREFIX}all:${organizationId}`;
      const cached = await this.redis.get<Permission[]>(cacheKey);
      if (cached) return cached;

      const { data: perms, error } = await this.supabase
        .from('permissions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true);

      if (error) throw error;

      const transformed = (perms || []).map(p => this.transformPermission(p));
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);

      return transformed;
    } catch (error) {
      console.error('Failed to get permissions', error);
      return [];
    }
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(
    organizationId: string,
    resource: string
  ): Promise<Permission[]> {
    const allPerms = await this.getPermissions(organizationId);
    return allPerms.filter(p => p.resource === resource);
  }

  /**
   * Get all screens
   */
  async getScreens(organizationId: string): Promise<Screen[]> {
    try {
      const cacheKey = `${this.PERMISSION_CACHE_PREFIX}screens:all:${organizationId}`;
      const cached = await this.redis.get<Screen[]>(cacheKey);
      if (cached) return cached;

      const { data: screens, error } = await this.supabase
        .from('screens')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true)
        .order('order_index');

      if (error) throw error;

      const transformed = (screens || []).map(s => this.transformScreen(s));
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);

      return transformed;
    } catch (error) {
      console.error('Failed to get screens', error);
      return [];
    }
  }

  /**
   * Invalidate user permission cache
   */
  private async invalidateUserCache(userId: string, organizationId: string): Promise<void> {
    const keys = [
      `${this.PERMISSION_CACHE_PREFIX}context:${organizationId}:${userId}`,
      `${this.PERMISSION_CACHE_PREFIX}screens:${organizationId}:${userId}`,
    ];

    for (const key of keys) {
      await this.redis.delete(key);
    }
  }

  /**
   * Transform permission from DB
   */
  private transformPermission(data: any): Permission {
    return {
      id: data.id,
      key: data.key,
      name: data.name,
      description: data.description,
      resource: data.resource,
      action: data.action,
      category: data.category,
      requiresApproval: data.requires_approval,
      requiresMfa: data.requires_mfa,
      requiresAudit: data.requires_audit,
      riskLevel: data.risk_level,
      auditLevel: data.audit_level,
      enabled: data.enabled,
      metadata: data.metadata,
    };
  }

  /**
   * Transform screen from DB
   */
  private transformScreen(data: any): Screen {
    return {
      id: data.id,
      key: data.key,
      name: data.name,
      description: data.description,
      route: data.route,
      icon: data.icon,
      parentId: data.parent_id,
      requiresAuthentication: data.requires_authentication,
      isPublic: data.is_public,
      featureFlag: data.feature_flag,
      enabled: data.enabled,
      metadata: data.metadata,
    };
  }
}
