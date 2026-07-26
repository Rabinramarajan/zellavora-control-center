/**
 * Public entry point for the RBAC module.
 * Import via `import { RbacService, HasPermissionDirective, ... } from '@core/rbac';`
 */

export * from './models/permission.model';
export * from './models/role.model';
export * from './models/policy.model';
export * from './models/check.model';

export * from './store/policy.store';
export * from './services/permission.service';
export * from './services/rbac.service';
export * from './services/audit-log.service';

export * from './guards/permission.guard';
export * from './directives/has-permission.directive';
export * from './directives/has-role.directive';
export * from './directives/has-feature.directive';
export * from './interceptors/policy-version.interceptor';
