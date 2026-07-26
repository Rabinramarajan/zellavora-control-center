import { TemplateRef } from '@angular/core';

/**
 * Component-Level Permission Type Definitions
 * Fine-grained authorization for UI components
 */

/**
 * Component permission states
 */
export enum ComponentState {
  VISIBLE = 'visible',          // Component is visible and interactive
  HIDDEN = 'hidden',            // Component is not visible (DOM removed)
  DISABLED = 'disabled',        // Component is visible but disabled
  READONLY = 'readonly',        // Component is visible but read-only
  EDITABLE = 'editable',        // Component is visible and fully editable
}

/**
 * Component visibility states
 */
export enum VisibilityState {
  SHOW = 'show',                // Always show
  HIDE = 'hide',                // Always hide
  CONDITIONAL = 'conditional', // Show based on permissions/conditions
}

/**
 * Supported component types
 */
export enum ComponentType {
  BUTTON = 'button',
  CARD = 'card',
  TABLE = 'table',
  TAB = 'tab',
  SECTION = 'section',
  WIDGET = 'widget',
  DIALOG = 'dialog',
  FORM = 'form',
  COLUMN = 'column',
  MENU_ITEM = 'menu_item',
  TOOLBAR_BUTTON = 'toolbar_button',
  FAB = 'fab',
  ACTION = 'action',
  INPUT = 'input',
  TEXTAREA = 'textarea',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  SWITCH = 'switch',
  PANEL = 'panel',
  MODAL = 'modal',
  TOOLTIP = 'tooltip',
  BREADCRUMB = 'breadcrumb',
  NAVIGATION = 'navigation',
}

/**
 * Component permission configuration
 */
export interface ComponentPermission {
  id?: string;
  componentId: string;           // Unique identifier
  componentType: ComponentType;

  // Permissions
  requiredPermissions?: string[]; // Permissions needed to view
  requiredRoles?: string[];       // Roles needed to view
  requiredFeatures?: string[];    // Features needed (feature flags)

  // State configuration
  defaultState: ComponentState;   // Default state
  stateOverrides?: Record<string, ComponentState>; // Role-specific states

  // Visibility
  visibility: VisibilityState;
  visibilityCondition?: Record<string, any>;

  // Conditional rendering
  conditionalRender?: {
    condition: 'AND' | 'OR';
    permissions?: string[];
    roles?: string[];
    features?: string[];
  };

  // Metadata
  label?: string;
  tooltip?: string;
  metadata?: Record<string, any>;
}

/**
 * Component state result
 */
export interface ComponentPermissionState {
  componentId: string;
  currentState: ComponentState;
  isVisible: boolean;
  isDisabled: boolean;
  isReadonly: boolean;
  isEditable: boolean;
  reasons?: string[]; // Why component is in this state
}

/**
 * Component permission check request
 */
export interface ComponentPermissionCheckRequest {
  componentId: string;
  componentType: ComponentType;
  permissions?: string[];
  roles?: string[];
  features?: string[];
  requiredState?: ComponentState;
}

/**
 * Component permission check response
 */
export interface ComponentPermissionCheckResponse {
  allowed: boolean;
  state: ComponentState;
  message?: string;
}

/**
 * Permission context for component
 */
export interface ComponentContext {
  componentId: string;
  userRole: string;
  userPermissions: Set<string>;
  deniedPermissions: Set<string>;
  enabledFeatures: Set<string>;
  organizationId: string;
}

/**
 * Component permission matrix
 */
export interface ComponentPermissionMatrix {
  componentId: string;
  componentType: ComponentType;
  roleStates: Record<string, ComponentState>; // role -> state
  permissionChecks: Record<string, boolean>;  // permission -> allowed
}

/**
 * Directive config for component permissions
 */
export interface ComponentPermissionDirectiveConfig {
  permissions?: string | string[];
  roles?: string | string[];
  features?: string | string[];
  state?: ComponentState;
  fallbackState?: ComponentState;
  mode?: 'any' | 'all'; // 'any' = OR, 'all' = AND
  else?: TemplateRef<any>; // Template to show if denied
}

/**
 * Component state utilities
 */
export const ComponentStateUtils = {
  isVisible: (state: ComponentState): boolean => {
    return state === ComponentState.VISIBLE ||
           state === ComponentState.EDITABLE ||
           state === ComponentState.READONLY ||
           state === ComponentState.DISABLED;
  },

  isDisabled: (state: ComponentState): boolean => {
    return state === ComponentState.DISABLED ||
           state === ComponentState.READONLY;
  },

  isReadonly: (state: ComponentState): boolean => {
    return state === ComponentState.READONLY;
  },

  isEditable: (state: ComponentState): boolean => {
    return state === ComponentState.EDITABLE;
  },

  isInteractive: (state: ComponentState): boolean => {
    return state === ComponentState.VISIBLE ||
           state === ComponentState.EDITABLE;
  },

  getCSS: (state: ComponentState): string => {
    switch (state) {
      case ComponentState.HIDDEN:
        return 'hidden';
      case ComponentState.DISABLED:
        return 'disabled opacity-50 cursor-not-allowed';
      case ComponentState.READONLY:
        return 'pointer-events-none opacity-75';
      case ComponentState.EDITABLE:
      case ComponentState.VISIBLE:
      default:
        return '';
    }
  },
};

/**
 * Permission mode utilities
 */
export const PermissionModeUtils = {
  evaluate: (
    permissions: string[],
    userPermissions: Set<string>,
    deniedPermissions: Set<string>,
    mode: 'any' | 'all' = 'any'
  ): boolean => {
    if (!permissions || permissions.length === 0) return true;

    const hasPermission = (perm: string) => {
      return userPermissions.has(perm) && !deniedPermissions.has(perm);
    };

    if (mode === 'all') {
      return permissions.every(hasPermission);
    } else {
      return permissions.some(hasPermission);
    }
  },
};

/**
 * Standard component permission presets
 */
export const ComponentPermissionPresets = {
  // Button presets
  ViewButton: {
    state: ComponentState.VISIBLE,
    permissions: ['resource:view'],
  } as Partial<ComponentPermission>,

  CreateButton: {
    state: ComponentState.VISIBLE,
    permissions: ['resource:create'],
  } as Partial<ComponentPermission>,

  EditButton: {
    state: ComponentState.VISIBLE,
    permissions: ['resource:edit'],
  } as Partial<ComponentPermission>,

  DeleteButton: {
    state: ComponentState.HIDDEN,
    permissions: ['resource:delete'],
  } as Partial<ComponentPermission>,

  // Form presets
  ReadOnlyForm: {
    state: ComponentState.READONLY,
  } as Partial<ComponentPermission>,

  EditableForm: {
    state: ComponentState.EDITABLE,
    permissions: ['resource:edit'],
  } as Partial<ComponentPermission>,

  // Table presets
  ViewTable: {
    state: ComponentState.VISIBLE,
    permissions: ['resource:view'],
  } as Partial<ComponentPermission>,

  EditableTable: {
    state: ComponentState.EDITABLE,
    permissions: ['resource:edit'],
  } as Partial<ComponentPermission>,
};
