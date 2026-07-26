/**
 * Permission model — five types: feature, screen, component, action, database.
 */

export type PermissionType = 'feature' | 'screen' | 'component' | 'action' | 'database';
export type PermissionEffect = 'allow' | 'deny';

export interface Permission {
  id: string;
  key: string;                                  // e.g. "users:user:create"
  type: PermissionType;
  label: string;
  description?: string;
  groupId?: string;
  metadata?: Record<string, unknown>;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PermissionGroup {
  id: string;
  key: string;                                  // e.g. "user_management"
  label: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  permissions?: Permission[];
}
