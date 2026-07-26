import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Permission,
  Screen,
  UserPermissionContext,
  PermissionCheckRequest,
  PermissionCheckResponse,
  AuditLogEntry,
  GrantPermissionRequest,
  DenyPermissionRequest,
} from '../../shared/models/permission.model';

/**
 * Permission Service
 * Manages user permissions, screens, and authorization
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly apiBaseUrl = '/api/v1/permissions';

  // State signals
  private readonly userPermissions = signal<Set<string>>(new Set());
  private readonly deniedPermissions = signal<Set<string>>(new Set());
  private readonly accessibleScreens = signal<Screen[]>([]);
  private readonly allPermissions = signal<Permission[]>([]);
  private readonly allScreens = signal<Screen[]>([]);
  private readonly userRole = signal<string>('');
  private readonly isLoading = signal(false);
  private readonly error = signal<string | null>(null);
  private readonly cacheExpiry = signal<number>(0);

  // Computed selectors
  readonly permissions = this.userPermissions.asReadonly();
  readonly denied = this.deniedPermissions.asReadonly();
  readonly screens = this.accessibleScreens.asReadonly();
  readonly allPerms = this.allPermissions.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly role = this.userRole.asReadonly();

  readonly isCacheValid = computed(() => Date.now() < this.cacheExpiry());
  readonly hasPermissions = computed(() => this.userPermissions().size > 0);

  constructor(private httpClient: HttpClient) {}

  /**
   * Load user's permissions and accessible screens
   */
  async loadPermissions(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const context = await firstValueFrom(
        this.httpClient.get<UserPermissionContext>(`${this.apiBaseUrl}/user`)
      );

      this.userPermissions.set(new Set(context.permissions));
      this.deniedPermissions.set(new Set(context.denied));
      this.userRole.set(context.userRole);
      this.cacheExpiry.set(new Date(context.cacheExpiry).getTime());

      // Also load accessible screens
      await this.loadAccessibleScreens();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load permissions';
      this.error.set(message);
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load user's accessible screens
   */
  async loadAccessibleScreens(): Promise<Screen[]> {
    try {
      const response = await firstValueFrom(
        this.httpClient.get<{ items: Screen[] }>(`${this.apiBaseUrl}/screens`)
      );

      this.accessibleScreens.set(response.items || []);
      return response.items || [];
    } catch (err) {
      console.error('Failed to load accessible screens', err);
      return [];
    }
  }

  /**
   * Check if user has permission(s)
   */
  async hasPermission(permission: string | string[], mode: 'any' | 'all' = 'any'): Promise<boolean> {
    try {
      const request: PermissionCheckRequest = {
        permissions: permission,
        mode,
      };

      const response = await firstValueFrom(
        this.httpClient.post<PermissionCheckResponse>(
          `${this.apiBaseUrl}/check`,
          request
        )
      );

      return response.allowed;
    } catch (err) {
      console.error('Permission check failed', err);
      return false;
    }
  }

  /**
   * Check if user has any of the permissions
   */
  async hasAnyPermission(permissions: string[]): Promise<boolean> {
    return this.hasPermission(permissions, 'any');
  }

  /**
   * Check if user has all permissions
   */
  async hasAllPermissions(permissions: string[]): Promise<boolean> {
    return this.hasPermission(permissions, 'all');
  }

  /**
   * Check if user can perform action on resource
   */
  async canAccess(resource: string, action: string): Promise<boolean> {
    const permissionKey = `${resource}:${action}`;
    return this.hasPermission(permissionKey);
  }

  /**
   * Get permission from cache (synchronous)
   */
  hasPermissionSync(permission: string): boolean {
    return this.userPermissions().has(permission) && !this.deniedPermissions().has(permission);
  }

  /**
   * Check screen accessibility (synchronous)
   */
  canAccessScreen(screenKey: string): boolean {
    return this.accessibleScreens().some(s => s.key === screenKey);
  }

  /**
   * Load all permissions (admin)
   */
  async loadAllPermissions(resource?: string): Promise<Permission[]> {
    try {
      let params = new HttpParams();
      if (resource) {
        params = params.set('resource', resource);
      }

      const response = await firstValueFrom(
        this.httpClient.get<{ items: Permission[] }>(
          `${this.apiBaseUrl}/list`,
          { params }
        )
      );

      const perms = response.items || [];
      this.allPermissions.set(perms);
      return perms;
    } catch (err) {
      console.error('Failed to load all permissions', err);
      return [];
    }
  }

  /**
   * Load all screens (admin)
   */
  async loadAllScreens(): Promise<Screen[]> {
    try {
      const response = await firstValueFrom(
        this.httpClient.get<{ items: Screen[] }>(`${this.apiBaseUrl}/screens/all`)
      );

      const screens = response.items || [];
      this.allScreens.set(screens);
      return screens;
    } catch (err) {
      console.error('Failed to load all screens', err);
      return [];
    }
  }

  /**
   * Get resource permissions (admin)
   */
  getResourcePermissions(resource: string): Permission[] {
    return this.allPermissions().filter(p => p.resource === resource);
  }

  /**
   * Grant permission to user (admin)
   */
  async grantPermission(request: GrantPermissionRequest): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.post(`${this.apiBaseUrl}/grant`, request)
      );

      // Invalidate cache
      this.cacheExpiry.set(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to grant permission';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Deny permission for user (admin)
   */
  async denyPermission(request: DenyPermissionRequest): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.post(`${this.apiBaseUrl}/deny`, request)
      );

      // Invalidate cache
      this.cacheExpiry.set(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deny permission';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Get audit logs (admin)
   */
  async getAuditLogs(
    userId?: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLogEntry[]> {
    try {
      let params = new HttpParams()
        .set('limit', limit.toString())
        .set('offset', offset.toString());

      if (userId) {
        params = params.set('userId', userId);
      }

      const response = await firstValueFrom(
        this.httpClient.get<{ items: AuditLogEntry[] }>(
          `${this.apiBaseUrl}/audit`,
          { params }
        )
      );

      return response.items || [];
    } catch (err) {
      console.error('Failed to load audit logs', err);
      return [];
    }
  }

  /**
   * Get user's audit logs
   */
  async getUserAuditLogs(userId: string, limit = 50, offset = 0): Promise<AuditLogEntry[]> {
    try {
      const response = await firstValueFrom(
        this.httpClient.get<{ items: AuditLogEntry[] }>(
          `${this.apiBaseUrl}/audit/${userId}`,
          {
            params: new HttpParams()
              .set('limit', limit.toString())
              .set('offset', offset.toString()),
          }
        )
      );

      return response.items || [];
    } catch (err) {
      console.error('Failed to load user audit logs', err);
      return [];
    }
  }

  /**
   * Clear state
   */
  clearCache(): void {
    this.userPermissions.set(new Set());
    this.deniedPermissions.set(new Set());
    this.accessibleScreens.set([]);
    this.cacheExpiry.set(0);
    this.error.set(null);
  }
}
