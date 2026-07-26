import { Pipe, PipeTransform } from '@angular/core';
import { PermissionService } from '../../core/permissions/permission.service';

/**
 * Permission Pipe
 * Displays text based on user permissions
 *
 * Usage:
 *   {{ 'projects:create' | hasPermission }}  // true/false
 *   {{ value | hasPermission }}               // true/false
 */
@Pipe({
  name: 'hasPermission',
  standalone: true,
  pure: false,
})
export class HasPermissionPipe implements PipeTransform {
  constructor(private permissionService: PermissionService) {}

  transform(permission: string | string[]): boolean {
    if (!permission) return false;

    // Use synchronous check if possible
    if (typeof permission === 'string') {
      return this.permissionService.hasPermissionSync(permission);
    }

    // For multiple permissions, use synchronous checks
    // This is a simplified check - for complex logic use async
    return permission.some(p => this.permissionService.hasPermissionSync(p));
  }
}

/**
 * Permission Matrix Pipe
 * Formats permission matrix for display
 *
 * Usage:
 *   {{ permissionMatrix | permissionMatrix: 'table' }}
 */
@Pipe({
  name: 'permissionMatrixFormat',
  standalone: true,
  pure: true,
})
export class PermissionMatrixPipe implements PipeTransform {
  transform(
    matrix: Record<string, Record<string, boolean>>,
    format: 'table' | 'csv' | 'json' = 'json'
  ): string {
    if (!matrix) return '';

    switch (format) {
      case 'csv':
        return this.formatAsCsv(matrix);
      case 'table':
        return this.formatAsTable(matrix);
      case 'json':
      default:
        return JSON.stringify(matrix, null, 2);
    }
  }

  private formatAsCsv(matrix: Record<string, Record<string, boolean>>): string {
    const resources = Object.keys(matrix);
    if (resources.length === 0) return '';

    const actions = Object.keys(matrix[resources[0]]);
    const header = ['Resource', ...actions].join(',');

    const rows = resources.map(resource => {
      const values = actions.map(action => matrix[resource]?.[action] ? '1' : '0');
      return [resource, ...values].join(',');
    });

    return [header, ...rows].join('\n');
  }

  private formatAsTable(matrix: Record<string, Record<string, boolean>>): string {
    const resources = Object.keys(matrix);
    if (resources.length === 0) return '';

    const actions = Object.keys(matrix[resources[0]]);
    const maxResourceLength = Math.max(...resources.map(r => r.length), 8);

    let table = 'Resource'.padEnd(maxResourceLength);
    actions.forEach(action => {
      table += ' | ' + action.padEnd(10);
    });
    table += '\n' + '-'.repeat(maxResourceLength) + ' ' + '-'.repeat(actions.length * 14);

    resources.forEach(resource => {
      table += '\n' + resource.padEnd(maxResourceLength);
      actions.forEach(action => {
        const hasAccess = matrix[resource]?.[action] ? '✓' : '✗';
        table += ' | ' + hasAccess.padEnd(10);
      });
    });

    return table;
  }
}

/**
 * Risk Level Pipe
 * Formats risk level with color coding
 *
 * Usage:
 *   {{ permission.riskLevel | riskLevelColor }}
 */
@Pipe({
  name: 'riskLevelColor',
  standalone: true,
  pure: true,
})
export class RiskLevelColorPipe implements PipeTransform {
  transform(riskLevel: string): string {
    switch (riskLevel?.toLowerCase()) {
      case 'critical':
        return '#dc2626';  // red-600
      case 'high':
        return '#f97316';  // orange-500
      case 'medium':
        return '#eab308';  // yellow-400
      case 'low':
      default:
        return '#22c55e';  // green-500
    }
  }
}

/**
 * Audit Status Pipe
 * Formats audit status with icon/color
 *
 * Usage:
 *   {{ auditLog.status | auditStatusFormat }}
 */
@Pipe({
  name: 'auditStatusFormat',
  standalone: true,
  pure: true,
})
export class AuditStatusPipe implements PipeTransform {
  transform(status: string): string {
    switch (status?.toLowerCase()) {
      case 'allowed':
        return '✓ Allowed';
      case 'denied':
        return '✗ Denied';
      case 'pending_approval':
        return '⏳ Pending';
      default:
        return status;
    }
  }
}

/**
 * Export all permission pipes
 */
export const PERMISSION_PIPES = [
  HasPermissionPipe,
  PermissionMatrixPipe,
  RiskLevelColorPipe,
  AuditStatusPipe,
] as const;
