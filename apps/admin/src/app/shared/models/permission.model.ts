/**
 * Permission System Type Definitions
 * Screen-level authorization with fine-grained action permissions
 */

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AuditLevel {
  STANDARD = 'standard',
  DETAILED = 'detailed',
  NONE = 'none',
}

export enum AuditStatus {
  ALLOWED = 'allowed',
  DENIED = 'denied',
  PENDING_APPROVAL = 'pending_approval',
}

/**
 * Permission object
 */
export interface Permission {
  id: string;
  key: string;                      // e.g., "dashboard:view", "projects:create"
  name: string;
  description?: string;
  resource: string;                 // e.g., "dashboard", "projects"
  action: string;                   // e.g., "view", "create", "edit", "delete"
  category?: string;
  requiresApproval: boolean;
  requiresMfa: boolean;
  requiresAudit: boolean;
  riskLevel: RiskLevel;
  auditLevel: AuditLevel;
  enabled: boolean;
  metadata?: Record<string, any>;
}

/**
 * Screen (Feature/Page)
 */
export interface Screen {
  id: string;
  key: string;                      // e.g., "dashboard", "projects.list"
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

/**
 * User permission context
 */
export interface UserPermissionContext {
  userId: string;
  organizationId: string;
  userRole: string;
  permissions: string[];            // Array of permission keys
  denied: string[];                 // Explicitly denied permissions
  cacheExpiry: Date;
}

/**
 * Permission check request
 */
export interface PermissionCheckRequest {
  permissions: string | string[];
  mode?: 'any' | 'all';             // 'any' = user needs at least one, 'all' = user needs all
}

export interface PermissionCheckResponse {
  allowed: boolean;
  permissions: string[];
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  permissionId?: string;
  screenId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status: AuditStatus;
  denyReason?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  changeData?: Record<string, any>;
  resultData?: Record<string, any>;
  requestTimestamp: Date;
  responseTimeMs?: number;
}

/**
 * Request body for granting permission
 */
export interface GrantPermissionRequest {
  userId: string;
  permissionId: string;
  reason?: string;
  expiresAt?: string;  // ISO date string
}

/**
 * Request body for denying permission
 */
export interface DenyPermissionRequest {
  userId: string;
  permissionId: string;
  reason?: string;
}

/**
 * Resource actions (standard set)
 */
export const STANDARD_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'import',
  'approve',
  'reject',
  'archive',
  'restore',
  'clone',
  'print',
  'download',
  'generate',
  'publish',
  'unpublish',
  'share',
  'manage',
] as const;

export type StandardAction = typeof STANDARD_ACTIONS[number];

/**
 * Permission matrix for UI
 */
export interface PermissionMatrix {
  resources: string[];
  actions: string[];
  matrix: Record<string, Record<string, boolean>>;  // resource -> action -> allowed
}
