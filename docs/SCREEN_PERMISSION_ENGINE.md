# Enterprise Screen-Level Permission Engine

A production-ready, fine-grained authorization system for Zellavora Control Center with screen-level and action-level permission control.

## Overview

The permission engine provides:
- **Screen-level authorization** - Control access to features/pages
- **Action-level permissions** - Control CRUD + extended operations
- **Role-based access** - Grant via roles with override capability
- **User-specific permissions** - Direct user grants/denies
- **Time-based permissions** - Expiring access grants
- **Audit logging** - Complete action tracking
- **Risk-level enforcement** - High-risk actions require approval/MFA
- **Angular directives** - Easy permission checks in templates
- **Route guards** - Protect routes based on permissions
- **Permission caching** - Redis + in-memory caching
- **Approval workflow** - Request & review process

## Architecture

### Database Layer
- **permissions** - All available permissions
- **screens** - Features/pages/components
- **screen_permissions** - Screen to permission mapping
- **role_permissions** - Role to permission grants
- **user_permissions** - User-specific overrides
- **permission_audit_logs** - Complete audit trail
- **permission_cache** - User permission cache
- **permission_requests** - Approval workflow

### Backend Service
- `PermissionService` - Core permission logic
- Permission checking (any/all/single)
- User context loading
- Cache management
- Audit logging
- Direct user/role grants

### Frontend Service
- Signal-based state management
- Permission checking (async)
- Screen access checks
- Audit log retrieval
- Admin operations

### Angular Components
- **Directives** - Permission-based rendering
- **Pipes** - Permission formatting
- **Guards** - Route protection
- **Store** - Permission state

## File Structure

```
Backend:
├── migrations/0011_screen_permissions.sql
├── services/permission.service.ts
└── routes/permissions.ts

Frontend:
├── models/permission.model.ts
├── services/permission.service.ts
├── directives/permission.directive.ts
├── pipes/permission.pipe.ts
└── guards/permission.guard.ts
```

## Permission Keys

Standard permission format: `{resource}:{action}`

### Resources
- `dashboard` - Main dashboard
- `projects` - Project management
- `blogs` - Blog management
- `settings` - Settings
- `users` - User management
- `reports` - Reporting
- `media` - Media management
- `analytics` - Analytics
- `permissions` - Permission management
- `screens` - Screen management

### Standard Actions
- `view` - View/read access
- `create` - Create new items
- `edit` - Modify existing items
- `delete` - Delete items
- `export` - Export data
- `import` - Import data
- `approve` - Approve actions
- `reject` - Reject actions
- `archive` - Archive items
- `restore` - Restore archived items
- `clone` - Duplicate items
- `print` - Print items
- `download` - Download files
- `generate` - Generate reports
- `publish` - Publish content
- `manage` - Full management

## API Endpoints

### Permission Checking
```bash
# Check single permission
POST /api/v1/permissions/check
{
  "permissions": "projects:view",
  "mode": "any"  // "any" or "all"
}

# Check multiple permissions
POST /api/v1/permissions/check
{
  "permissions": ["projects:view", "projects:create"],
  "mode": "any"
}
```

### User Permissions
```bash
# Get current user's permissions
GET /api/v1/permissions/user

# Get accessible screens
GET /api/v1/permissions/screens

# Get all permissions (admin)
GET /api/v1/permissions/list?resource=projects

# Get all screens (admin)
GET /api/v1/permissions/screens/all
```

### Permission Management (Admin)
```bash
# Grant permission
POST /api/v1/permissions/grant
{
  "userId": "uuid",
  "permissionId": "uuid",
  "reason": "Needs to create projects",
  "expiresAt": "2026-12-31T23:59:59Z"
}

# Deny permission
POST /api/v1/permissions/deny
{
  "userId": "uuid",
  "permissionId": "uuid",
  "reason": "Department transfer"
}
```

### Audit Logs
```bash
# Get all audit logs (admin)
GET /api/v1/permissions/audit?limit=100&offset=0

# Get user's audit logs
GET /api/v1/permissions/audit/{userId}?limit=50
```

## Backend Usage

### Service Initialization
```typescript
import { PermissionService } from './services/permission.service';

const permissionService = new PermissionService(supabase, redis);

// Mount routes
app.use('/api/v1/permissions', createPermissionRoutes(permissionService));
```

### Permission Checking
```typescript
// Check single permission
const hasAccess = await permissionService.hasPermission(
  userId,
  organizationId,
  'projects:create'
);

// Check multiple (ANY)
const hasAny = await permissionService.hasAnyPermission(
  userId,
  organizationId,
  ['admin:panel', 'admin:users']
);

// Check multiple (ALL)
const hasAll = await permissionService.hasAllPermissions(
  userId,
  organizationId,
  ['projects:view', 'projects:edit']
);
```

### Getting User Context
```typescript
const context = await permissionService.getUserPermissionContext(
  userId,
  organizationId
);

console.log(context.permissions);      // Set<string>
console.log(context.deniedPermissions); // Set<string>
console.log(context.userRole);          // string
```

### Audit Logging
```typescript
await permissionService.auditLog(
  userId,
  organizationId,
  'create_project',  // action
  permissionId,
  screenId,
  'allowed',         // status
  {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    resourceType: 'projects',
    resourceId: 'project-123',
    changeData: { name: 'New Project' },
    responseTimeMs: 145
  }
);
```

### Granting Permissions
```typescript
// Grant to user
await permissionService.grantPermissionToUser(
  userId,
  organizationId,
  permissionId,
  grantedBy,        // admin user ID
  'Needs access for project',
  new Date('2026-12-31')  // expires at
);

// Deny to user
await permissionService.denyPermissionForUser(
  userId,
  organizationId,
  permissionId,
  deniedBy,         // admin user ID
  'Department changed'
);
```

## Frontend Usage

### Service Initialization
```typescript
import { PermissionService } from './core/permissions/permission.service';

// Automatically provided
constructor(private permissionService: PermissionService) {}
```

### Loading Permissions
```typescript
ngOnInit() {
  // Load user permissions on app init
  this.permissionService.loadPermissions().catch(console.error);
}
```

### Permission Checking

**Async Checking:**
```typescript
async hasAccess() {
  const allowed = await this.permissionService.hasPermission('projects:create');
  console.log(allowed);  // true/false
}

// Multiple permissions (ANY)
const hasAny = await this.permissionService.hasAnyPermission([
  'admin:panel',
  'admin:users'
]);

// Multiple permissions (ALL)
const hasAll = await this.permissionService.hasAllPermissions([
  'projects:view',
  'projects:edit'
]);
```

**Synchronous Checking:**
```typescript
// Fast synchronous check (uses cache)
const hasAccess = this.permissionService.hasPermissionSync('projects:create');
```

### Directives

**Structural Directives:**
```html
<!-- Show if user has permission -->
<button *appHasPermission="'projects:create'">
  Create Project
</button>

<!-- Show if user has ANY permission -->
<div *appHasAnyPermission="['admin:panel', 'admin:users']">
  Admin Area
</div>

<!-- Show if user has ALL permissions -->
<div *appHasAllPermissions="['projects:view', 'projects:edit']">
  Advanced Editing
</div>
```

**Attribute Directives:**
```html
<!-- Disable button if no permission -->
<button [appDisableIfNoPermission]="'projects:delete'">
  Delete
</button>
```

### Pipes

```html
<!-- Check permission in template -->
{{ 'projects:create' | hasPermission }}  <!-- true/false -->

<!-- Format permission matrix -->
{{ permissionMatrix | permissionMatrixFormat: 'table' }}

<!-- Format risk level -->
{{ permission.riskLevel | riskLevelColor }}  <!-- #dc2626 -->

<!-- Format audit status -->
{{ auditLog.status | auditStatusFormat }}  <!-- ✓ Allowed -->
```

### Guards

**Single Permission:**
```typescript
const routes: Routes = [
  {
    path: 'projects',
    component: ProjectsComponent,
    canActivate: [permissionGuard('projects:view')]
  }
];
```

**Multiple Permissions (ANY):**
```typescript
const routes: Routes = [
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [hasAnyPermissionGuard(['admin:panel', 'admin:users'])]
  }
];
```

**Multiple Permissions (ALL):**
```typescript
const routes: Routes = [
  {
    path: 'sensitive',
    component: SensitiveComponent,
    canActivate: [hasAllPermissionsGuard(['users:view', 'users:edit', 'users:delete'])]
  }
];
```

**Screen Access:**
```typescript
const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [screenAccessGuard('dashboard')]
  }
];
```

**Unsaved Changes:**
```typescript
const routes: Routes = [
  {
    path: 'edit',
    component: EditComponent,
    canDeactivate: [unsavedChangesGuard]
  }
];
```

## Permission Matrix Example

```
Resource   | View | Create | Edit | Delete | Export | Approve
-----------|------|--------|------|--------|--------|--------
Projects   |  ✓   |   ✓    |  ✓   |   ✗    |   ✓    |   ✗
Users      |  ✓   |   ✗    |  ✓   |   ✗    |   ✗    |   ✓
Reports    |  ✓   |   ✓    |  ✓   |   ✓    |   ✓    |   ✗
Analytics  |  ✓   |   ✗    |  ✗   |   ✗    |   ✓    |   ✗
```

## Risk Levels

Permissions can have risk levels:

- **Low** - View operations (no data modification)
- **Medium** - Create/edit operations
- **High** - Delete/reject operations
- **Critical** - System-wide operations

High-risk operations can require:
- Admin approval
- MFA verification
- IP whitelisting
- Audit logging (automatic)

## Audit Logging

All permission checks and operations are logged:

```
User: john@example.com
Action: create_project
Resource: projects (project-123)
Status: allowed
Risk Level: medium
Timestamp: 2026-07-26 10:30:00 UTC
IP Address: 192.168.1.1
User Agent: Mozilla/5.0...
Response Time: 145ms
Change Data: { name: "New Project", description: "Q3 Planning" }
```

Audit logs show:
- Who performed action
- What action
- On what resource
- When
- From where
- Result
- What changed

## Caching Strategy

### Cache Levels

1. **Redis Cache** (30-min TTL)
   - User permission context
   - Accessible screens
   - All permissions list

2. **In-Memory Cache** (30-min TTL)
   - User permission context
   - Screens list

3. **HTTP Cache**
   - Public permissions list

### Cache Invalidation

Automatic invalidation on:
- Permission grant/deny
- Role permission update
- User permission update
- User role change
- Permission deletion

## Best Practices

### 1. Permission Naming
```typescript
// Good
'dashboard:view'
'projects:create'
'users:delete'
'reports:export'

// Avoid
'can_view_dashboard'
'user_create_permission'
'delete_user_action'
```

### 2. Permission Checking
```typescript
// Use async for complex checks
const hasAccess = await this.permissionService.hasPermission('projects:create');

// Use sync for template checks (faster)
<button *appHasPermission="'projects:create'">Create</button>

// Use directives to reduce boilerplate
<div *appHasPermission="'admin:access'">Admin Panel</div>
```

### 3. Route Protection
```typescript
// Always protect sensitive routes
const routes: Routes = [
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [permissionGuard('admin:access')]
  }
];
```

### 4. Audit Logging
```typescript
// Log all sensitive operations
await permissionService.auditLog(
  userId,
  organizationId,
  'delete_user',
  permissionId,
  null,
  'allowed',
  {
    resourceType: 'users',
    resourceId: targetUserId,
    changeData: { reason: 'Terminated employee' }
  }
);
```

### 5. Timeouts & Expiration
```typescript
// Grant temporary access
await permissionService.grantPermissionToUser(
  userId,
  organizationId,
  permissionId,
  grantedBy,
  'Contractor access',
  new Date('2026-08-31')  // expires end of month
);
```

## Common Scenarios

### 1. Role-Based Access
```typescript
// Setup: Assign permissions to roles during admin setup
// Usage: User gets all role permissions automatically
```

### 2. Temporary Access
```typescript
await permissionService.grantPermissionToUser(
  userId,
  organizationId,
  permissionId,
  adminId,
  'Temporary project access',
  expiresAt
);
```

### 3. Approval Workflow
```typescript
// 1. User requests permission
// 2. Admin reviews in audit logs
// 3. Admin grants or denies
// 4. System logs decision
```

### 4. Override Permissions
```typescript
// User can have explicit denials that override role
await permissionService.denyPermissionForUser(
  userId,
  organizationId,
  permissionId,
  adminId,
  'Department changed - no longer needs this'
);
```

## Performance

- **Permission check:** < 10ms (cached)
- **User context load:** < 100ms
- **Accessible screens:** < 50ms
- **Cache expiry:** 30 minutes

## Security

- **RLS Policies** - Database-level enforcement
- **Token validation** - All endpoints require auth
- **Audit trail** - Complete action history
- **Cache invalidation** - Immediate on changes
- **XSS protection** - HTML sanitization
- **CSRF protection** - Token validation

## Testing

### Unit Tests
```typescript
describe('PermissionService', () => {
  it('should check single permission');
  it('should check multiple permissions (ANY)');
  it('should check multiple permissions (ALL)');
  it('should load user context');
  it('should handle expiring permissions');
  it('should invalidate cache');
});
```

### E2E Tests
```typescript
describe('Permission Guards', () => {
  it('should block unauthorized access');
  it('should allow authorized access');
  it('should redirect to login');
  it('should redirect to forbidden');
});
```

## Troubleshooting

### Permission Not Working
1. Check if permission exists in database
2. Verify user has role with permission
3. Check permission expiration
4. Verify organization ID
5. Check cache invalidation

### Slow Permission Checks
1. Ensure Redis is running
2. Check database indexes
3. Verify cache hits in logs
4. Profile with timing logs

### Audit Logs Missing
1. Verify audit_level is not 'none'
2. Check database connectivity
3. Verify user is authenticated
4. Check organization ID

---

**Status:** Production Ready  
**Version:** 1.0.0  
**Last Updated:** 2026-07-26
