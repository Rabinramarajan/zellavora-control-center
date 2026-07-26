# Screen Permission Engine - Quick Start (5 Minutes)

## 1. Apply Database Migration (2 min)

```bash
supabase db push
```

This creates all permission tables with proper indexes and RLS policies.

## 2. Backend Integration (3 min)

```typescript
// In apps/backend/src/index.ts

import { createPermissionRoutes } from './routes/permissions';
import { PermissionService } from './services/permission.service';

// Initialize service
const permissionService = new PermissionService(supabase, redis);

// Mount routes
app.use('/api/v1/permissions', createPermissionRoutes(permissionService));
```

## 3. Frontend Integration (2 min)

```typescript
// In apps/admin/src/app/app.config.ts

import { PermissionService } from './core/permissions/permission.service';
import { PERMISSION_DIRECTIVES } from './shared/directives/permission.directive';
import { PERMISSION_PIPES } from './shared/pipes/permission.pipe';

// Add to AppComponent
@Component({
  imports: [PERMISSION_DIRECTIVES, PERMISSION_PIPES],
})
export class AppComponent implements OnInit {
  constructor(private permissionService: PermissionService) {}
  
  ngOnInit() {
    // Load permissions on app start
    this.permissionService.loadPermissions();
  }
}
```

## Quick Usage Examples

### Check Permissions in Template

```html
<!-- Show if has permission -->
<button *appHasPermission="'projects:create'">
  Create Project
</button>

<!-- Show if has ANY permission -->
<div *appHasAnyPermission="['admin:panel', 'admin:users']">
  Admin Area
</div>

<!-- Show if has ALL permissions -->
<div *appHasAllPermissions="['projects:view', 'projects:edit']">
  Edit Projects
</div>

<!-- Disable if no permission -->
<button [appDisableIfNoPermission]="'projects:delete'">
  Delete
</button>
```

### Check Permissions in Code

```typescript
// Async check
const allowed = await this.permissionService.hasPermission('projects:create');

// Sync check (from cache)
const allowed = this.permissionService.hasPermissionSync('projects:create');

// Check multiple (ANY)
const hasAny = await this.permissionService.hasAnyPermission([
  'admin:panel',
  'admin:users'
]);

// Check multiple (ALL)
const hasAll = await this.permissionService.hasAllPermissions([
  'projects:view',
  'projects:edit'
]);
```

### Protect Routes

```typescript
const routes: Routes = [
  {
    path: 'projects',
    component: ProjectsComponent,
    canActivate: [permissionGuard('projects:view')]
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [hasAnyPermissionGuard(['admin:panel', 'admin:users'])]
  }
];
```

## Standard Permission Keys

| Resource | Actions |
|----------|---------|
| dashboard | view |
| projects | view, create, edit, delete, export |
| users | view, create, edit, delete, approve |
| reports | view, create, export |
| media | view, upload, delete |
| settings | view, edit |

Format: `{resource}:{action}`

Example: `projects:create`, `users:delete`, `reports:export`

## Admin: Grant Permissions

### API
```bash
# Grant to user
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "permissionId": "permission-uuid",
    "reason": "Needs to create projects",
    "expiresAt": "2026-12-31T23:59:59Z"
  }' \
  http://localhost:3000/api/v1/permissions/grant
```

### In Code
```typescript
await this.permissionService.grantPermission({
  userId: 'user-123',
  permissionId: 'perm-456',
  reason: 'Project lead',
  expiresAt: new Date('2026-12-31').toISOString()
});
```

## Admin: Deny Permissions

### API
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "permissionId": "permission-uuid",
    "reason": "Department changed"
  }' \
  http://localhost:3000/api/v1/permissions/deny
```

### In Code
```typescript
await this.permissionService.denyPermission({
  userId: 'user-123',
  permissionId: 'perm-456',
  reason: 'No longer needs access'
});
```

## Check Audit Logs

```typescript
// Get all audit logs (admin)
const logs = await this.permissionService.getAuditLogs();

// Get specific user's logs
const userLogs = await this.permissionService.getUserAuditLogs('user-123');

// Display in template
<div *ngFor="let log of userLogs">
  {{ log.action }} - {{ log.status | auditStatusFormat }}
</div>
```

## Common Tasks

### 1. Create New Permission
```sql
INSERT INTO permissions (
  organization_id, key, name, resource, action, risk_level
) VALUES (
  'org-uuid',
  'projects:publish',
  'Publish Projects',
  'projects',
  'publish',
  'high'
);
```

### 2. Grant Role Permission
```sql
INSERT INTO role_permissions (
  role_id, permission_id, granted
) VALUES (
  'role-uuid',
  'perm-uuid',
  true
);
```

### 3. View User Permissions
```typescript
const context = await this.permissionService.getUserPermissions();
console.log('Permissions:', context.permissions);
console.log('Denied:', context.denied);
```

### 4. Refresh Permissions
```typescript
// Force reload from server
await this.permissionService.loadPermissions();
```

## API Endpoints (Reference)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/check` | POST | Check permission |
| `/user` | GET | Get current user permissions |
| `/screens` | GET | Get accessible screens |
| `/list` | GET | Get all permissions (admin) |
| `/screens/all` | GET | Get all screens (admin) |
| `/grant` | POST | Grant permission (admin) |
| `/deny` | POST | Deny permission (admin) |
| `/audit` | GET | Get audit logs (admin) |
| `/audit/:userId` | GET | Get user audit logs |

## Testing

### Test Permission Check
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": "projects:view",
    "mode": "any"
  }' \
  http://localhost:3000/api/v1/permissions/check
```

Expected response:
```json
{
  "allowed": true,
  "permissions": ["projects:view"]
}
```

### Test Route Guard
```typescript
// Navigate to protected route
this.router.navigate(['/projects']);

// Should work if user has 'projects:view' permission
// Otherwise redirects to /forbidden
```

## Troubleshooting

**Q: Permission not working in template**
- A: Ensure directive is imported in component
- A: Check permission key is correct
- A: Verify user has permission (check /user endpoint)

**Q: Slow permission checks**
- A: Wait for cache to warm up (30 seconds)
- A: Verify Redis is running
- A: Check network latency

**Q: Audit logs not appearing**
- A: Check permission has audit_level != 'none'
- A: Verify database connectivity
- A: Check user is authenticated

**Q: Permission changes not taking effect**
- A: Cache expires in 30 minutes
- A: Call `loadPermissions()` to refresh
- A: Restart app to clear local cache

## Common Patterns

### Admin-Only Area
```html
<div *appHasPermission="'admin:access'">
  <h2>Admin Panel</h2>
  <button *appHasPermission="'users:create'">Add User</button>
  <button *appHasPermission="'users:delete'">Delete User</button>
</div>
```

### Conditional Actions
```html
<button *appHasPermission="'projects:edit'">Edit</button>
<button *appHasPermission="'projects:delete'">Delete</button>
<button *appHasPermission="'projects:export'">Export</button>
```

### Feature Preview
```html
<div *appHasPermission="'features:beta'">
  <h3>✨ New Feature</h3>
  <p>This is a beta feature</p>
</div>
```

### Approval Workflow
```html
<div *appHasPermission="'approvals:manage'">
  <h3>Pending Approvals</h3>
  <div *ngFor="let item of pendingItems">
    <button *appHasPermission="'approvals:approve'">Approve</button>
    <button *appHasPermission="'approvals:reject'">Reject</button>
  </div>
</div>
```

## Next Steps

1. ✅ Apply database migration
2. ✅ Integrate backend service
3. ✅ Integrate frontend service
4. ✅ Add directives to components
5. ✅ Protect routes with guards
6. ✅ Test permission checks
7. ✅ Create admin UI for grants (optional)

## Files Created

- `0011_screen_permissions.sql` - Database schema
- `permission.service.ts` (backend) - Permission logic
- `permissions.ts` - API routes
- `permission.model.ts` - Type definitions
- `permission.service.ts` (frontend) - Angular service
- `permission.directive.ts` - Template directives
- `permission.pipe.ts` - Template pipes
- `permission.guard.ts` - Route guards

## Full Documentation

See [SCREEN_PERMISSION_ENGINE.md](./SCREEN_PERMISSION_ENGINE.md) for complete reference.

---

**Ready to use! 🚀**
