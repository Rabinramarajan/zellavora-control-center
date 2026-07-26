import { Injectable, signal, computed, effect } from '@angular/core';
import { PermissionService } from './permission.service';
import {
  ComponentPermission,
  ComponentPermissionState,
  ComponentState,
  ComponentType,
  ComponentContext,
  ComponentPermissionCheckRequest,
  ComponentPermissionCheckResponse,
  ComponentStateUtils,
  PermissionModeUtils,
} from '../../shared/models/component-permission.model';

/**
 * Component-Level Permission Service
 * Manages fine-grained permissions for individual UI components
 */
@Injectable({ providedIn: 'root' })
export class ComponentPermissionService {
  // Cache of component permissions
  private readonly componentPermissions = signal<Map<string, ComponentPermission>>(new Map());

  // User context cache
  private readonly userRole = signal<string>('');
  private readonly userPermissions = signal<Set<string>>(new Set());
  private readonly deniedPermissions = signal<Set<string>>(new Set());
  private readonly enabledFeatures = signal<Set<string>>(new Set());
  private readonly organizationId = signal<string>('');

  // State cache (componentId -> state)
  private readonly componentStates = signal<Map<string, ComponentPermissionState>>(new Map());

  // Computed context
  readonly context = computed(() => ({
    userRole: this.userRole(),
    userPermissions: this.userPermissions(),
    deniedPermissions: this.deniedPermissions(),
    enabledFeatures: this.enabledFeatures(),
    organizationId: this.organizationId(),
  }));

  constructor(private permissionService: PermissionService) {
    // Sync with permission service changes
    effect(() => {
      const permissions = Array.from(this.permissionService.permissions());
      this.userPermissions.set(permissions as unknown as Set<string>);
      this.userRole.set(this.permissionService.role());
    });
  }

  /**
   * Initialize component permissions with user context
   */
  async initializeContext(organizationId: string): Promise<void> {
    this.organizationId.set(organizationId);
    await this.permissionService.loadPermissions();

    // Update context with loaded permissions
    const context = this.permissionService['getUserPermissionContext']?.(
      // Access through reflection if needed
    );
  }

  /**
   * Register component permission
   */
  registerComponentPermission(
    componentId: string,
    permission: ComponentPermission
  ): void {
    const updated = new Map(this.componentPermissions());
    updated.set(componentId, permission);
    this.componentPermissions.set(updated);
  }

  /**
   * Register multiple component permissions
   */
  registerComponentPermissions(
    permissions: Map<string, ComponentPermission> | Record<string, ComponentPermission>
  ): void {
    const map = permissions instanceof Map ? permissions : new Map(Object.entries(permissions));
    const updated = new Map(this.componentPermissions());

    map.forEach((permission, componentId) => {
      updated.set(componentId, permission);
    });

    this.componentPermissions.set(updated);
  }

  /**
   * Check component permission and return state
   */
  async checkComponentPermission(
    request: ComponentPermissionCheckRequest
  ): Promise<ComponentPermissionCheckResponse> {
    try {
      // Get component permission config
      const config = this.componentPermissions().get(request.componentId);

      // Determine the state
      let state = request.requiredState || ComponentState.VISIBLE;

      if (config) {
        state = await this.determineComponentState(config, request);
      } else if (request.permissions || request.roles) {
        // Check requested permissions
        state = await this.determineStateFromPermissions(request);
      }

      const allowed = !this.isStateBlocked(state);

      return {
        allowed,
        state,
        message: allowed ? 'Access granted' : `Access denied. Component is ${state}`,
      };
    } catch (error) {
      console.error('Component permission check failed', error);
      return {
        allowed: false,
        state: ComponentState.HIDDEN,
        message: 'Permission check failed',
      };
    }
  }

  /**
   * Get component permission state
   */
  async getComponentState(
    componentId: string,
    componentType: ComponentType
  ): Promise<ComponentPermissionState> {
    // Check cache first
    const cached = this.componentStates().get(componentId);
    if (cached) return cached;

    const config = this.componentPermissions().get(componentId);
    if (!config) {
      // No permission config, use default visible state
      return {
        componentId,
        currentState: ComponentState.VISIBLE,
        isVisible: true,
        isDisabled: false,
        isReadonly: false,
        isEditable: true,
      };
    }

    const state = await this.determineComponentState(config, {
      componentId,
      componentType,
    });

    const result: ComponentPermissionState = {
      componentId,
      currentState: state,
      isVisible: ComponentStateUtils.isVisible(state),
      isDisabled: ComponentStateUtils.isDisabled(state),
      isReadonly: ComponentStateUtils.isReadonly(state),
      isEditable: ComponentStateUtils.isEditable(state),
    };

    // Cache result
    const updated = new Map(this.componentStates());
    updated.set(componentId, result);
    this.componentStates.set(updated);

    return result;
  }

  /**
   * Get multiple component states
   */
  async getComponentStates(
    componentIds: string[]
  ): Promise<Map<string, ComponentPermissionState>> {
    const results = new Map<string, ComponentPermissionState>();

    for (const componentId of componentIds) {
      const config = this.componentPermissions().get(componentId);
      if (config) {
        const state = await this.getComponentState(componentId, config.componentType);
        results.set(componentId, state);
      }
    }

    return results;
  }

  /**
   * Check if component is visible
   */
  async isComponentVisible(componentId: string): Promise<boolean> {
    const state = await this.getComponentState(componentId, ComponentType.BUTTON);
    return state.isVisible;
  }

  /**
   * Check if component is editable
   */
  async isComponentEditable(componentId: string): Promise<boolean> {
    const state = await this.getComponentState(componentId, ComponentType.FORM);
    return state.isEditable;
  }

  /**
   * Check if component is disabled
   */
  async isComponentDisabled(componentId: string): Promise<boolean> {
    const state = await this.getComponentState(componentId, ComponentType.BUTTON);
    return state.isDisabled;
  }

  /**
   * Check if component is read-only
   */
  async isComponentReadonly(componentId: string): Promise<boolean> {
    const state = await this.getComponentState(componentId, ComponentType.FORM);
    return state.isReadonly;
  }

  /**
   * Sync component state with user permissions
   */
  async syncComponentStates(componentIds: string[]): Promise<void> {
    const states = await this.getComponentStates(componentIds);
    const updated = new Map(this.componentStates());

    states.forEach((state, componentId) => {
      updated.set(componentId, state);
    });

    this.componentStates.set(updated);
  }

  /**
   * Get CSS classes for component state
   */
  getComponentStateClasses(componentId: string): string {
    const state = this.componentStates().get(componentId);
    if (!state) return '';

    return ComponentStateUtils.getCSS(state.currentState);
  }

  /**
   * Private helper methods
   */

  private async determineComponentState(
    config: ComponentPermission,
    request: ComponentPermissionCheckRequest
  ): Promise<ComponentState> {
    // Check feature flags first
    if (config.requiredFeatures && config.requiredFeatures.length > 0) {
      const hasAllFeatures = config.requiredFeatures.every(f =>
        this.enabledFeatures().has(f)
      );
      if (!hasAllFeatures) {
        return config.stateOverrides?.['no-feature'] || ComponentState.HIDDEN;
      }
    }

    // Check permissions
    if (config.requiredPermissions && config.requiredPermissions.length > 0) {
      const hasPermission = await this.permissionService.hasPermission(
        config.requiredPermissions,
        'any'
      );

      if (!hasPermission) {
        return config.stateOverrides?.['no-permission'] || config.defaultState;
      }
    }

    // Check roles
    if (config.requiredRoles && config.requiredRoles.length > 0) {
      const hasRole = config.requiredRoles.includes(this.userRole());

      if (!hasRole) {
        return config.stateOverrides?.[`no-role-${this.userRole()}`] || config.defaultState;
      }

      // Apply role-specific state override
      const roleState = config.stateOverrides?.[this.userRole()];
      if (roleState) {
        return roleState;
      }
    }

    // Apply conditional rendering
    if (config.conditionalRender) {
      const conditionMet = await this.evaluateCondition(config.conditionalRender);
      return conditionMet ? config.defaultState : ComponentState.HIDDEN;
    }

    return config.defaultState;
  }

  private async determineStateFromPermissions(
    request: ComponentPermissionCheckRequest
  ): Promise<ComponentState> {
    if (request.permissions) {
      const hasPermission = await this.permissionService.hasPermission(
        request.permissions,
        'any'
      );

      if (!hasPermission) {
        return request.requiredState === ComponentState.VISIBLE
          ? ComponentState.DISABLED
          : ComponentState.HIDDEN;
      }
    }

    if (request.roles) {
      const hasRole = request.roles.includes(this.userRole());

      if (!hasRole) {
        return request.requiredState === ComponentState.VISIBLE
          ? ComponentState.DISABLED
          : ComponentState.HIDDEN;
      }
    }

    if (request.features) {
      const hasAllFeatures = request.features.every(f =>
        this.enabledFeatures().has(f)
      );

      if (!hasAllFeatures) {
        return request.requiredState === ComponentState.VISIBLE
          ? ComponentState.DISABLED
          : ComponentState.HIDDEN;
      }
    }

    return request.requiredState || ComponentState.VISIBLE;
  }

  private async evaluateCondition(condition: {
    condition: 'AND' | 'OR';
    permissions?: string[];
    roles?: string[];
    features?: string[];
  }): Promise<boolean> {
    const checks: boolean[] = [];

    // Check permissions
    if (condition.permissions) {
      const hasPermission = await this.permissionService.hasPermission(
        condition.permissions,
        'any'
      );
      checks.push(hasPermission);
    }

    // Check roles
    if (condition.roles) {
      const hasRole = condition.roles.includes(this.userRole());
      checks.push(hasRole);
    }

    // Check features
    if (condition.features) {
      const hasAllFeatures = condition.features.every(f =>
        this.enabledFeatures().has(f)
      );
      checks.push(hasAllFeatures);
    }

    if (checks.length === 0) return true;

    return condition.condition === 'AND'
      ? checks.every(c => c)
      : checks.some(c => c);
  }

  private isStateBlocked(state: ComponentState): boolean {
    return state === ComponentState.HIDDEN;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.componentStates.set(new Map());
  }
}
