/**
 * Menu System Type Definitions
 * Supports unlimited nesting, permissions, feature flags, and usage tracking
 */

export enum MenuVisibilityType {
  ALL = 'all',
  AUTHENTICATED = 'authenticated',
  ROLE = 'role',
  CUSTOM = 'custom',
}

export enum BadgeStyle {
  DEFAULT = 'default',
  SUCCESS = 'success',
  DANGER = 'danger',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Complex visibility conditions for conditional menu display
 */
export interface MenuVisibilityCondition {
  roles?: string[];                    // Match if user has ANY role
  tenants?: string[];                  // Match if user in ANY tenant
  permissions?: string[];              // Match if user has ANY permission
  featureFlags?: string[];             // Match if ALL flags enabled
  customCondition?: Record<string, any>; // Custom condition object
}

/**
 * Menu item badge for displaying counts, status, etc
 */
export interface MenuBadge {
  icon?: string;
  value?: number | string;
  style: BadgeStyle;
  animated?: boolean;
}

/**
 * Single menu item in the hierarchy
 */
export interface MenuNode {
  // Identity
  id: string;
  key: string;

  // Display properties
  label: string;
  title?: string;
  description?: string;
  icon?: string | null;
  badge?: MenuBadge;

  // Navigation
  route?: string | null;
  externalUrl?: string | null;

  // Hierarchy
  parentId?: string | null;
  children: MenuNode[];
  orderIndex: number;
  nestingLevel: number;
  breadcrumbPath?: string[];  // Array of parent IDs [id1, id2, id3]

  // Features & Access Control
  category?: string;
  featureFlag?: string;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiresAllPermissions?: boolean;

  // State
  visible: boolean;
  visibilityType: MenuVisibilityType;
  visibilityCondition?: MenuVisibilityCondition;
  isFavorite?: boolean;
  isRecent?: boolean;
  viewCount?: number;

  // Tracking
  lastAccessedAt?: string;
  accessCount?: number;

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Complete menu tree with categories and metadata
 */
export interface MenuTree {
  items: MenuNode[];
  timestamp: Date;
  version: number;
  categories: MenuCategory[];
}

/**
 * Menu category for grouping menu items
 */
export interface MenuCategory {
  id: string;
  key: string;
  label: string;
  icon?: string;
  color?: string;
  orderIndex: number;
  description?: string;
}

/**
 * User's menu usage tracking
 */
export interface MenuUsageTrack {
  menuId: string;
  isFavorite: boolean;
  lastAccessedAt: Date;
  accessCount: number;
}

/**
 * Request/Response DTOs for API
 */

export interface CreateMenuRequest {
  key: string;
  label: string;
  title?: string;
  description?: string;
  icon?: string;
  route?: string;
  externalUrl?: string;
  parentId?: string;
  orderIndex?: number;
  category?: string;
  featureFlag?: string;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiresAllPermissions?: boolean;
  visible?: boolean;
  visibilityType?: MenuVisibilityType;
  visibilityCondition?: MenuVisibilityCondition;
  badge?: MenuBadge;
  metadata?: Record<string, any>;
}

export interface UpdateMenuRequest extends Partial<CreateMenuRequest> {}

export interface MenuTreeResponse {
  items: MenuNode[];
  timestamp: string;
  version: number;
  categories: MenuCategory[];
}

export interface MenusResponse {
  items: MenuNode[];
}

export interface CategoriesResponse {
  items: MenuCategory[];
}
