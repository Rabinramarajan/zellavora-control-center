/**
 * Role model — system role (organizationId = null) or org-specific role.
 */

import type { PermissionEffect } from './permission.model';

export interface RolePermission {
  key: string;
  label?: string;
  type?: string;
  effect: PermissionEffect;
}

export interface Role {
  id: string;
  organizationId?: string | null;
  key: string;                                  // e.g. "org_admin"
  label: string;
  description?: string;
  level: number;
  isSystem: boolean;
  color?: string;
  metadata?: Record<string, unknown>;
  permissions?: RolePermission[];
  inheritsFrom?: RoleRef[];
  inheritedBy?: RoleRef[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleRef {
  id: string;
  key: string;
  label: string;
  level: number;
}

export interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  organizationId: string;
  resourceType?: string;
  resourceId?: string;
  status: 'active' | 'suspended' | 'expired';
  validFrom: string;
  validUntil?: string;
  assignedAt: string;
  assignedBy?: string;
}
